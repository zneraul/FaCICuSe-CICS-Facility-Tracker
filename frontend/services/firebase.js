import { initializeApp } from 'firebase/app';
import { applyActionCode, getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import {
  buildUserProfileCreateFields,
  buildUserProfileUpdateFields,
} from './userProfileSync.js';
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
 * Synchronizes a verified Firebase Auth user's profile document to Firestore (/users/{uid}).
 * Creates a complete rule-compliant document or updates only owner-editable profile fields.
 * Role, email, account status, and creation time remain immutable for client-side sync.
 */
export async function syncUserProfileToFirestore(firebaseUser, profile) {
  if (!firebaseUser?.uid || !firebaseUser.emailVerified || !profile) return;
  const userDocPath = `users/${firebaseUser.uid}`;
  const userRef = doc(db, 'users', firebaseUser.uid);

  try {
    const createFields = buildUserProfileCreateFields(firebaseUser, profile);
    const updateFields = buildUserProfileUpdateFields(profile, firebaseUser);
    if (!createFields || !updateFields) return;

    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(userRef);
      if (snapshot.exists()) {
        transaction.update(userRef, {
          ...updateFields,
          updatedAt: serverTimestamp(),
        });
      } else {
        transaction.set(userRef, {
          ...createFields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch (error) {
    // The API-backed session remains authoritative; Firestore sync is supplementary.
    console.warn(`[Firestore] Profile sync skipped for ${userDocPath}:`, error?.message || error);
  }
}
