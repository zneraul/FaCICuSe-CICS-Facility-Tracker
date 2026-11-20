import crypto from 'node:crypto';

const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

/**
 * Hashes a user password with Node's crypto.scrypt and a unique 16-byte random salt.
 * Stored format: scrypt$<saltHex>$<derivedKeyHex>
 */
export function hashPassword(plainPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto
    .scryptSync(String(plainPassword), salt, SCRYPT_KEYLEN, SCRYPT_PARAMS)
    .toString('hex');
  return `scrypt$${salt}$${derived}`;
}

/**
 * Timing-safe verification of a plaintext password against a stored scrypt hash.
 */
export function verifyPassword(plainPassword, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;

  try {
    const derived = crypto.scryptSync(String(plainPassword), salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * Generates a cryptographically strong single-use email verification token and its SHA-256 hash.
 * Only the hash is persisted in storage; the raw token is sent exclusively in the verification URL.
 */
export function generateVerificationToken(ttlMs = 1000 * 60 * 60 * 24) {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashVerificationToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  return { rawToken, tokenHash, expiresAt };
}

export function hashVerificationToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken || '')).digest('hex');
}
