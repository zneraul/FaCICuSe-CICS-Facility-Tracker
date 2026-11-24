import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ||= 'postgres://postgres:postgres@127.0.0.1:5432/facicuse_test';
process.env.SQL_SSL = 'false';

const { pool } = await import('./connection.ts');
const { createPostgresAdapters } = await import('./repositories.js');

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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      actor_user_id INTEGER REFERENCES users(id),
      actor_email TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  // Truncate both tables together because audit_logs has a foreign key to users.
  await pool.query('TRUNCATE TABLE audit_logs, users RESTART IDENTITY');

  t.after(async () => {
    await pool.query('TRUNCATE TABLE audit_logs, users RESTART IDENTITY');
    await pool.end();
  });

  const { userRepo, auditLogPort } = createPostgresAdapters();
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

  await assert.rejects(
    auditLogPort.record({
      actorUserId: 999999999,
      actorEmail: 'missing-actor@g.batstate-u.edu.ph',
      actorRole: 'admin',
      action: 'AUDIT_FAILURE_TEST',
      entityType: 'test',
      entityId: 'missing-actor',
      details: 'This insert must fail its actor foreign-key constraint.',
    }),
    (error) => {
      assert.match(error.message, /Database operation failed during record audit log/);
      assert.ok(error.cause, 'The original database error should be preserved as cause.');
      return true;
    }
  );

  const failedAudit = await pool.query(
    "SELECT id FROM audit_logs WHERE action = 'AUDIT_FAILURE_TEST'"
  );
  assert.equal(failedAudit.rowCount, 0, 'A rejected audit insert must not create a partial row.');
});
