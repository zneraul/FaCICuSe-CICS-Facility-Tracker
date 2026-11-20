import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
process.env.DATABASE_URL ||= 'postgres://postgres:postgres@127.0.0.1:5432/facicuse_test';
process.env.SQL_SSL = 'false';

const { pool } = await import('../../../src/db/index.ts');
const { createPostgresAdapters } = await import('../../adapters/outbound/postgresRepositories.js');
const { createAuthProviderAdapter } = await import('../../adapters/outbound/firebaseAuthAdapter.js');
const { getAuth } = await import('firebase-admin/auth');
const { createAuthMiddleware, SESSION_COOKIE_NAME } = await import('../../adapters/inbound/authMiddleware.js');
const { createHttpControllers } = await import('../../adapters/inbound/httpControllers.js');
const { createApiRouter } = await import('../../adapters/inbound/routes.js');
const { createUserUseCases } = await import('./userUseCases.js');
const { EmailDomainPolicy } = await import('../../domain/valueObjects.js');
const passwordHasher = await import('../../adapters/outbound/passwordHasher.js');

test('Firebase Auth Emulator → PostgreSQL → HttpOnly session → password setup works end to end', async (t) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      uid TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      department TEXT,
      academic_block TEXT,
      auth_provider TEXT NOT NULL DEFAULT 'google',
      email_verified BOOLEAN NOT NULL DEFAULT TRUE,
      password_hash TEXT,
      verification_token_hash TEXT,
      verification_token_expires_at TIMESTAMP,
      is_demo BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  const uidMarker = `auth-e2e-${Date.now()}`;
  const email = `${uidMarker}@g.batstate-u.edu.ph`;
  const provider = createAuthProviderAdapter({
    sessionSecret: 'isolated-ci-session-secret-at-least-32-chars',
  });
  const { userRepo } = createPostgresAdapters();
  const userUseCases = createUserUseCases({
    userRepo,
    auditLogPort: { record: async () => {} },
    domainPolicy: new EmailDomainPolicy('g.batstate-u.edu.ph,batstate-u.edu.ph'),
    passwordHasher,
  });
  const authMiddleware = createAuthMiddleware({ authProvider: provider, userRepo, userUseCases });
  const controllers = createHttpControllers({
    facilityUseCases: {},
    reservationUseCases: {},
    classScheduleUseCases: {},
    maintenanceUseCases: {},
    userUseCases,
    dashboardUseCases: {},
    analyticsUseCases: {},
    authProvider: provider,
    domainPolicy: new EmailDomainPolicy('g.batstate-u.edu.ph,batstate-u.edu.ph'),
  });

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api', createApiRouter({ controllers, authMiddleware }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.query('DELETE FROM users WHERE uid = $1', [uidMarker]);
    await pool.end();
  });

  const signupResponse = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'Emulator-Test-Password-123!',
        returnSecureToken: true,
      }),
    }
  );
  const signup = await signupResponse.json();
  assert.equal(signupResponse.ok, true, JSON.stringify(signup));
  assert.ok(signup.idToken);
  assert.ok(signup.localId);

  const unverifiedResponse = await fetch(`${baseUrl}/auth/session/google`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${signup.idToken}`,
      'content-type': 'application/json',
      'x-forwarded-proto': 'https',
    },
    body: '{}',
  });
  assert.equal(unverifiedResponse.status, 401);
  assert.equal(await userRepo.findByUid(signup.localId), null);

  await getAuth().updateUser(signup.localId, { emailVerified: true });

  const signinResponse = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'Emulator-Test-Password-123!',
        returnSecureToken: true,
      }),
    }
  );
  const verified = await signinResponse.json();
  assert.equal(signinResponse.ok, true, JSON.stringify(verified));
  assert.ok(verified.idToken);
  const verifiedClaims = await provider.verifyFirebaseIdToken(verified.idToken);
  assert.equal(verifiedClaims.email_verified, true);

  const sessionResponse = await fetch(`${baseUrl}/auth/session/google`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${verified.idToken}`,
      'content-type': 'application/json',
      'x-forwarded-proto': 'https',
    },
    body: '{}',
  });
  assert.equal(sessionResponse.status, 200);
  const sessionBody = await sessionResponse.json();
  assert.equal(sessionBody.user.uid, signup.localId);
  assert.equal(sessionBody.user.email, email);
  assert.equal(Object.hasOwn(sessionBody, 'sessionToken'), false);

  const setCookie = sessionResponse.headers.get('set-cookie') || '';
  assert.match(setCookie, new RegExp(`${SESSION_COOKIE_NAME}=`));
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /SameSite=Lax/i);
  const cookie = setCookie.split(';')[0];

  const restoredResponse = await fetch(`${baseUrl}/auth/session`, {
    headers: { cookie },
  });
  assert.equal(restoredResponse.status, 200);
  const restored = await restoredResponse.json();
  assert.equal(restored.user.uid, signup.localId);
  assert.equal(restored.user.email, email);

  const newPassword = 'FaCICuSe-Emulator-Password-2026!';
  const passwordResponse = await fetch(`${baseUrl}/auth/password`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ password: newPassword, confirmPassword: newPassword }),
  });
  assert.equal(passwordResponse.status, 200, await passwordResponse.text());

  const authRecord = await userRepo.findAuthRecordByEmail(email);
  assert.equal(authRecord.authProvider, 'google+password');
  assert.ok(authRecord.passwordHash.startsWith('scrypt$'));
  assert.equal(passwordHasher.verifyPassword(newPassword, authRecord.passwordHash), true);
  const publicUser = await userRepo.findByUid(signup.localId);
  assert.equal(Object.hasOwn(publicUser, 'passwordHash'), false);

  const logoutResponse = await fetch(`${baseUrl}/auth/logout`, {
    method: 'POST',
    headers: { cookie, 'x-forwarded-proto': 'https' },
  });
  assert.equal(logoutResponse.status, 200);
  assert.match(logoutResponse.headers.get('set-cookie') || '', /Expires=Thu, 01 Jan 1970/i);
});
