import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgres://postgres:postgres@127.0.0.1:5432/facicuse_test';
process.env.SQL_SSL = 'false';

const { pool } = await import('../../../src/db/index.ts');
const { createPostgresAdapters } = await import('./postgresRepositories.js');

test('PostgreSQL user adapter persists FaCICuSe password hashes and sanitizes public users', async (t) => {
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
  await pool.query('TRUNCATE TABLE users RESTART IDENTITY');

  t.after(async () => {
    await pool.query('TRUNCATE TABLE users RESTART IDENTITY');
    await pool.end();
  });

  const { userRepo } = createPostgresAdapters();
  const inserted = await pool.query(
    `INSERT INTO users (uid, email, full_name, role, email_verified, is_active)
     VALUES ($1, $2, $3, $4, TRUE, TRUE) RETURNING id`,
    ['postgres-adapter-test-uid', 'adapter-test@g.batstate-u.edu.ph', 'Adapter Test User', 'student']
  );
  assert.ok(inserted.rows[0].id);

  const saved = await userRepo.setPasswordByUid(
    'postgres-adapter-test-uid',
    'scrypt$test-only-password-hash'
  );
  assert.equal(saved.uid, 'postgres-adapter-test-uid');
  assert.equal(saved.authProvider, 'google+password');
  assert.equal(Object.hasOwn(saved, 'passwordHash'), false);

  const authRecord = await userRepo.findAuthRecordByEmail(' ADAPTER-TEST@G.BATSTATE-U.EDU.PH ');
  assert.equal(authRecord.passwordHash, 'scrypt$test-only-password-hash');
  assert.equal(authRecord.authProvider, 'google+password');

  const publicUser = await userRepo.findByUid('postgres-adapter-test-uid');
  assert.equal(publicUser.email, 'adapter-test@g.batstate-u.edu.ph');
  assert.equal(Object.hasOwn(publicUser, 'passwordHash'), false);
  assert.equal(Object.hasOwn(publicUser, 'verificationTokenHash'), false);
});
