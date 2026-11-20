import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRuntimeConfig } from './config.js';

const productionDatabaseUrl = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://user:pass@db.example.test:5432/facicuse',
  APP_URL: 'https://facicuse.example.test',
};

test('production requires a strong SESSION_SECRET even when DATABASE_URL is configured', () => {
  assert.throws(
    () => validateRuntimeConfig(productionDatabaseUrl),
    /SESSION_SECRET must be configured with a strong secret/
  );
});

test('production rejects short or placeholder session secrets', () => {
  for (const SESSION_SECRET of ['short-secret', 'CHANGE_ME_TO_A_SECRET_VALUE']) {
    assert.throws(
      () => validateRuntimeConfig({ ...productionDatabaseUrl, SESSION_SECRET }),
      /SESSION_SECRET must be configured with a strong secret/
    );
  }
});

test('production accepts a configured session secret of at least 32 characters', () => {
  const config = validateRuntimeConfig({
    ...productionDatabaseUrl,
    SESSION_SECRET: 'a'.repeat(32),
  });
  assert.equal(config.isProduction, true);
  assert.equal(config.storageMode, 'postgres');
});

test('development may omit SESSION_SECRET and use the development fallback', () => {
  const config = validateRuntimeConfig({ NODE_ENV: 'development' });
  assert.equal(config.sessionSecret, '');
  assert.equal(config.isProduction, false);
});
