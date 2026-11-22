import dotenv from 'dotenv';
import { DEFAULT_UNIVERSITY_DOMAINS } from '../domain/valueObjects.js';

dotenv.config();

function isConfiguredValue(value) {
  const trimmed = String(value || '').trim();
  return Boolean(trimmed && !trimmed.toUpperCase().startsWith('CHANGE_ME'));
}

export function isPostgresConfigured(env = process.env) {
  if (isConfiguredValue(env.DATABASE_URL)) {
    return true;
  }
  return Boolean(
    isConfiguredValue(env.SQL_HOST) &&
      isConfiguredValue(env.SQL_DB_NAME) &&
      isConfiguredValue(env.SQL_USER) &&
      isConfiguredValue(env.SQL_PASSWORD)
  );
}

export function validateRuntimeConfig(env = process.env) {
  const port = Number(env.PORT || 3000);
  const rawDomains = String(env.ALLOWED_UNIVERSITY_DOMAINS || '').trim();
  const allowedUniversityDomains = rawDomains || DEFAULT_UNIVERSITY_DOMAINS.join(',');
  const rawBootstrapAdmins = String(env.ADMIN_BOOTSTRAP_EMAILS || '');
  const adminBootstrapEmails = rawBootstrapAdmins
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const sessionSecret = String(env.SESSION_SECRET || '').trim();
  const appUrl = String(env.APP_URL || `http://localhost:${port}`).replace(/\/+$/, '');
  const isProduction = env.NODE_ENV === 'production';
  const postgresReady = isPostgresConfigured(env);

  if (isProduction && !isConfiguredValue(env.DATABASE_URL)) {
    const missing = [];
    if (!isConfiguredValue(env.SQL_HOST)) missing.push('SQL_HOST');
    if (!isConfiguredValue(env.SQL_DB_NAME)) missing.push('SQL_DB_NAME');
    if (!isConfiguredValue(env.SQL_USER)) missing.push('SQL_USER');
    if (!isConfiguredValue(env.SQL_PASSWORD)) missing.push('SQL_PASSWORD');

    if (missing.length > 0) {
      throw new Error(
        `Production startup aborted: PostgreSQL configuration is incomplete or uses placeholder values (${missing.join(', ')}). Local JSON fallback is disabled in production.`
      );
    }
  }

  if (isProduction && (!isConfiguredValue(sessionSecret) || sessionSecret.length < 32)) {
    throw new Error(
      'Production startup aborted: SESSION_SECRET must be configured with a strong secret (at least 32 characters, not a placeholder).'
    );
  }

  const storageMode = postgresReady ? 'postgres' : 'local';

  return {
    port,
    appUrl,
    allowedUniversityDomains,
    adminBootstrapEmails,
    sessionSecret,
    isProduction,
    storageMode,
  };
}

export function loadConfig() {
  return validateRuntimeConfig(process.env);
}
