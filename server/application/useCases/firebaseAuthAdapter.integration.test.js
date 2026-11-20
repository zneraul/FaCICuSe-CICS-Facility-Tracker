import test from 'node:test';
import assert from 'node:assert/strict';

process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';

const { createAuthProviderAdapter } = await import('../../adapters/outbound/firebaseAuthAdapter.js');
const provider = createAuthProviderAdapter({ sessionSecret: 'firebase-emulator-test-session-secret' });

test('Firebase Admin verifies an ID token issued by the Auth Emulator', async () => {
  const email = `emulator-${Date.now()}@g.batstate-u.edu.ph`;
  const response = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'Emulator-Test-Password-123!', returnSecureToken: true }),
    }
  );
  const account = await response.json();
  assert.equal(response.ok, true, JSON.stringify(account));
  assert.ok(account.idToken);
  assert.ok(account.localId);

  const decoded = await provider.verifyFirebaseIdToken(account.idToken);
  assert.equal(decoded.uid, account.localId);
  assert.equal(decoded.email, email);
  assert.equal(decoded.email_verified, false);
});

test('Firebase Admin rejects an invalid Auth Emulator token', async () => {
  await assert.rejects(
    provider.verifyFirebaseIdToken('not-a-valid-firebase-token'),
    /Firebase ID token|Decoding Firebase ID token|argument/,
  );
});
