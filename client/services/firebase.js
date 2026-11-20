import { initializeApp } from 'firebase/app';
import { applyActionCode, getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: 'select_account' });

export { applyActionCode };

export const OperationType = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
});

export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified ?? false,
      isAnonymous: auth.currentUser?.isAnonymous ?? false,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

/**
 * Synchronizes a verified Firebase Auth user's profile document to Firestore (/users/{uid}),
 * strictly conforming to firebase-blueprint.json and firestore.rules.
 */
export async function syncUserProfileToFirestore(firebaseUser, profile) {
  if (!firebaseUser?.uid || !firebaseUser.emailVerified || !profile) return;
  const userDocPath = `users/${firebaseUser.uid}`;
  try {
    await setDoc(
      doc(db, 'users', firebaseUser.uid),
      {
        uid: firebaseUser.uid,
        email: String(profile.email || firebaseUser.email || '').toLowerCase(),
        fullName: String(profile.fullName || firebaseUser.displayName || 'Campus User').slice(0, 120),
        role: profile.role === 'admin' ? 'admin' : profile.role === 'professor' ? 'professor' : 'student',
        department: String(profile.department || 'College of Informatics and Computing Sciences (CICS)').slice(0, 150),
        academicBlock: profile.academicBlock ? String(profile.academicBlock).slice(0, 20) : '',
        emailVerified: true,
        isActive: true,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    // Do not block the primary session if rules restrict a role field update on existing user
    console.warn(`[Firestore] Profile sync skipped for ${userDocPath}:`, error?.message || error);
  }
}
