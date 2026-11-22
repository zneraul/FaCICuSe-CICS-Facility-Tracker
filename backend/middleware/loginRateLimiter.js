const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;

export function createLoginRateLimiter({
  windowMs = DEFAULT_WINDOW_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  now = Date.now,
} = {}) {
  const attemptsByIp = new Map();

  return function loginRateLimiter(req, res, next) {
    const key = String(req.ip || req.socket?.remoteAddress || 'unknown');
    const currentTime = now();
    let entry = attemptsByIp.get(key);

    if (!entry || currentTime >= entry.resetAt) {
      entry = { count: 0, resetAt: currentTime + windowMs };
      attemptsByIp.set(key, entry);
    }

    if (entry.count >= maxAttempts) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - currentTime) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        error: 'Too many sign-in attempts. Please wait before trying again.',
        code: 'LOGIN_RATE_LIMITED',
      });
    }

    entry.count += 1;

    // Bound memory use if many distinct source addresses hit the login endpoint.
    if (attemptsByIp.size > 10000) {
      for (const [address, value] of attemptsByIp) {
        if (currentTime >= value.resetAt) attemptsByIp.delete(address);
      }
      if (attemptsByIp.size > 10000) {
        const oldestKey = attemptsByIp.keys().next().value;
        if (oldestKey !== undefined) attemptsByIp.delete(oldestKey);
      }
    }

    return next();
  };
}
