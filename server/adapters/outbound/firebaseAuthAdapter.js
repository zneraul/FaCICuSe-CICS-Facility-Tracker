import crypto from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../../firebase-applet-config.json' with { type: 'json' };

if (!getApps().length && firebaseConfig?.projectId) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const adminAuth = getApps().length ? getAuth() : null;

export function createAuthProviderAdapter({ sessionSecret }) {
  const secret = sessionSecret || crypto.createHash('sha256').update(firebaseConfig.projectId || 'facicuse-dev').digest('hex');

  function signPayload(payloadJson) {
    return crypto.createHmac('sha256', secret).update(payloadJson).digest('base64url');
  }

  function issueSessionToken(uid, type = 'user', ttlMs = 1000 * 60 * 60 * 24) {
    const payload = JSON.stringify({
      uid,
      type,
      iat: Date.now(),
      exp: Date.now() + ttlMs,
    });
    const encoded = Buffer.from(payload, 'utf8').toString('base64url');
    const sig = signPayload(encoded);
    return `${encoded}.${sig}`;
  }

  function verifySessionToken(token, expectedType = null) {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
      return null;
    }
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;
    const expectedSig = signPayload(encoded);
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
    try {
      const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
      if (!parsed.uid || !parsed.exp || parsed.exp < Date.now()) {
        return null;
      }
      if (expectedType && parsed.type && parsed.type !== expectedType) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  return {
    async verifyFirebaseIdToken(idToken) {
      if (!adminAuth) {
        throw new Error('Firebase Admin Auth is not initialized.');
      }
      return await adminAuth.verifyIdToken(idToken);
    },

    issueSessionToken,
    verifySessionToken,
  };
}
