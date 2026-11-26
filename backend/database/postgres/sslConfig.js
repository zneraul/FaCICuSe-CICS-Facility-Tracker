/**
 * PostgreSQL TLS helpers.
 *
 * Connection-string SSL parameters override node-postgres's `ssl` config object.
 * Normalize hosted SSL URLs to verify-full so certificate-chain and hostname checks
 * are explicit rather than relying on an encryption-only mode.
 */
export function withVerifiedPostgresSslMode(connectionString, enabled = true) {
  if (!enabled) return connectionString;

  const parsed = new URL(connectionString);
  parsed.searchParams.set('sslmode', 'verify-full');
  return parsed.toString();
}

export function createPostgresSslOptions(enabled) {
  return enabled ? { rejectUnauthorized: true } : undefined;
}
