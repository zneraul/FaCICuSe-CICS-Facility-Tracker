/**
 * Pure authentication redirect & university email input validation helpers.
 * Keeps client validation aligned with server-side EmailDomainPolicy and RBAC routes.
 */

export function resolvePostLoginPath(user, requestedPath = '') {
  const role = String(user?.role || '').toLowerCase();
  const raw = String(requestedPath || '').trim();

  // Only allow safe internal workspace routes (/app/...), preventing open redirects
  if (raw.startsWith('/app/') && !raw.startsWith('//') && !raw.includes('://')) {
    const isAdminRoute = raw === '/app/admin' || raw.startsWith('/app/admin/');
    if (isAdminRoute && role !== 'admin') {
      return '/app/dashboard';
    }
    return raw;
  }

  return '/app/dashboard';
}

export function validateUniversityEmailInput(email, allowedDomains = []) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) {
    return {
      valid: false,
      error: 'Please enter a valid university email address.',
    };
  }

  const parts = normalized.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1] || !parts[1].includes('.')) {
    return {
      valid: false,
      error: 'Please enter a valid university email address.',
    };
  }

  const domain = parts[1];
  const domains = (Array.isArray(allowedDomains) ? allowedDomains : [])
    .map((d) => String(d || '').trim().toLowerCase())
    .filter(Boolean);

  if (domains.length > 0 && !domains.includes(domain)) {
    return {
      valid: false,
      error: `Only verified university email domains (${domains.join(', ')}) are permitted.`,
    };
  }

  return { valid: true, email: normalized };
}
