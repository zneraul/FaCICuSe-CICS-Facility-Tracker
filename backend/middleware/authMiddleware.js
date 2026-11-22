export const SESSION_COOKIE_NAME = 'facicuse_session';

export function parseCookies(cookieHeader = '') {
  const cookies = {};
  if (!cookieHeader) return cookies;
  const pairs = String(cookieHeader).split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) {
      cookies[key] = decodeURIComponent(val);
    }
  }
  return cookies;
}

export function createAuthMiddleware({ authProvider, userRepo, userUseCases }) {
  async function resolveActor(req) {
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.slice('Bearer '.length).trim();
      if (!idToken) return null;
      const decoded = await authProvider.verifyFirebaseIdToken(idToken);
      const user = await userUseCases.syncVerifiedGoogleUser(decoded);
      return user;
    }

    const cookies = parseCookies(req.headers.cookie);

    const userSessionToken = String(cookies[SESSION_COOKIE_NAME] || '').trim();
    if (userSessionToken) {
      const verifiedUser = authProvider.verifySessionToken(userSessionToken, 'user');
      if (verifiedUser?.uid) {
        const user = await userRepo.findByUid(verifiedUser.uid);
        if (user && user.isActive && user.emailVerified !== false && !user.isDemo) {
          return user;
        }
      }
    }

    return null;
  }

  async function requireAuth(req, res, next) {
    try {
      const actor = await resolveActor(req);
      if (!actor) {
        return res.status(401).json({
          error: 'Authentication required. Please sign in to access this resource.',
        });
      }
      req.actor = actor;
      return next();
    } catch (error) {
      return res.status(401).json({
        error: error.message || 'Invalid or expired authentication credentials.',
      });
    }
  }

  function requireRole(...allowedRoles) {
    return (req, res, next) => {
      if (!req.actor) {
        return res.status(401).json({ error: 'Authentication required.' });
      }
      if (!allowedRoles.includes(req.actor.role)) {
        return res.status(403).json({
          error: 'Forbidden: your account role is not authorized for this resource.',
        });
      }
      return next();
    };
  }

  async function optionalAuth(req, _res, next) {
    try {
      req.actor = await resolveActor(req);
    } catch {
      req.actor = null;
    }
    return next();
  }

  return {
    optionalAuth,
    requireAuth,
    requireRole,
  };
}
