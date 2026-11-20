import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onIdTokenChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  auth,
  googleAuthProvider,
  syncUserProfileToFirestore,
} from '../services/firebase.js';
import {
  apiRequest,
  setAuthToken,
} from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);
  const [authConfig, setAuthConfig] = useState({
    allowedDomainsConfigured: true,
    allowedDomains: ['g.batstate-u.edu.ph', 'batstate-u.edu.ph'],
  });

  const refreshProfile = useCallback(async () => {
    try {
      const data = await apiRequest('/auth/me');
      setUser(data.user || null);
      setAuthError('');
      return data.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    apiRequest('/auth/config')
      .then((cfg) => setAuthConfig(cfg))
      .catch(() => {});

    let active = true;
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (!active) return;
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          setAuthToken(token);
          const data = await apiRequest('/auth/me');
          if (active) {
            setUser(data.user);
            setAuthError('');
            syncUserProfileToFirestore(firebaseUser, data.user);
          }
        } catch (err) {
          setAuthToken(null);
          if (active) {
            setAuthError(err.message || 'Unable to verify university account.');
            setUser(null);
          }
        } finally {
          if (active) setLoading(false);
        }
      } else {
        setAuthToken(null);
        try {
          const data = await apiRequest('/auth/session');
          if (active) {
            if (!data.user) {
            }
            setUser(data.user || null);
          }
        } catch {
          if (active) setUser(null);
        } finally {
          if (active) setLoading(false);
        }
      }
    });

    const handleSessionExpired = () => {
      if (!active) return;
      setAuthToken(null);
      setSessionExpired(true);
      setUser(null);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('facicuse:session-expired', handleSessionExpired);
    }

    return () => {
      active = false;
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('facicuse:session-expired', handleSessionExpired);
      }
    };
  }, []);

  async function signInWithEmail({ email, password }) {
    setAuthError('');
    setSessionExpired(false);
    if (auth.currentUser) {
      await signOut(auth).catch(() => {});
      setAuthToken(null);
    }
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setUser(data.user);
    return data.user;
  }

  async function signInWithGoogle() {
    setAuthError('');
    setSessionExpired(false);
    const result = await signInWithPopup(auth, googleAuthProvider);
    const token = await result.user.getIdToken();
    setAuthToken(token);
    try {
      const data = await apiRequest('/auth/session/google', { method: 'POST' });
      setUser(data.user);
      syncUserProfileToFirestore(result.user, data.user);
      return data.user;
    } catch (err) {
      await signOut(auth).catch(() => {});
      setAuthToken(null);
      setAuthError(err.message);
      throw err;
    }
  }

  async function logout() {
    setAuthError('');
    setSessionExpired(false);
    setAuthToken(null);
    if (auth.currentUser) {
      await signOut(auth).catch(() => {});
    }
    await apiRequest('/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        sessionExpired,
        authConfig,
        signInWithEmail,
        signInWithGoogle,
        logout,
        refreshProfile,
        setAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
