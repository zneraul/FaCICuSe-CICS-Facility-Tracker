let inMemoryIdToken = null;

export function setAuthToken(token) {
  inMemoryIdToken = token || null;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemoryIdToken) {
    headers.set('Authorization', `Bearer ${inMemoryIdToken}`);
  }

  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    if (!response.ok) {
      throw new Error('Failed to export CSV report.');
    }
    return response.text();
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (
      response.status === 401 &&
      !path.startsWith('/auth/') &&
      typeof window !== 'undefined'
    ) {
      window.dispatchEvent(new CustomEvent('facicuse:session-expired'));
    }
    const error = new Error(data.error || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.code = data.code;
    throw error;
  }

  const method = String(options.method || 'GET').toUpperCase();
  if (
    method !== 'GET' &&
    method !== 'HEAD' &&
    !path.startsWith('/notifications') &&
    (path.startsWith('/reservations') ||
      path.startsWith('/issues') ||
      path.startsWith('/admin/'))
  ) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('facicuse:notifications-dirty'));
    }
  }

  return data;
}
