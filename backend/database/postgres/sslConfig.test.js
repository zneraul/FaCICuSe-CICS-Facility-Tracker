import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPostgresSslOptions,
  withVerifiedPostgresSslMode,
} from './sslConfig.js';

test('verified SSL mode replaces encryption-only modes in PostgreSQL URLs', () => {
  const input = 'postgresql://app:secret@ep-example.neon.tech/neondb?sslmode=require&channel_binding=require';
  const result = new URL(withVerifiedPostgresSslMode(input, true));

  assert.equal(result.searchParams.get('sslmode'), 'verify-full');
  assert.equal(result.searchParams.get('channel_binding'), 'require');
  assert.equal(result.hostname, 'ep-example.neon.tech');
  assert.equal(result.pathname, '/neondb');
});

test('verified SSL mode preserves unrelated connection parameters', () => {
  const input = 'postgres://app:secret@db.example.test/app?application_name=facicuse&sslmode=prefer';
  const result = new URL(withVerifiedPostgresSslMode(input, true));

  assert.equal(result.searchParams.get('sslmode'), 'verify-full');
  assert.equal(result.searchParams.get('application_name'), 'facicuse');
});

test('non-SSL PostgreSQL URLs remain unchanged when TLS is disabled', () => {
  const input = 'postgres://localhost/app';
  assert.equal(withVerifiedPostgresSslMode(input, false), input);
});

test('SQL_* TLS options explicitly verify the server certificate', () => {
  assert.deepEqual(createPostgresSslOptions(true), { rejectUnauthorized: true });
  assert.equal(createPostgresSslOptions(false), undefined);
});
