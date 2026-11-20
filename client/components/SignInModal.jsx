import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, Info, ShieldAlert, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { PROJECT_INFO } from '../../server/domain/projectInfo.js';
import {
  resolvePostLoginPath,
  validateUniversityEmailInput,
} from '../utils/authRedirect.js';

export function SignInModal({
  isOpen,
  onClose,
  returnTo = '/app/dashboard',
  initialNotice = '',
  initialNoticeType = 'info',
}) {
  const {
    authConfig,
    authError,
    signInWithEmail,
    signInWithGoogle,
    setAuthError,
  } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busyMode, setBusyMode] = useState('');
  const [localError, setLocalError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [visibleClass, setVisibleClass] = useState(false);

  const dialogRef = useRef(null);
  const emailInputRef = useRef(null);
  const lastFocusedRef = useRef(null);
  const submitLockRef = useRef(false);

  const isBusy = Boolean(busyMode);

  // Sync entrance animation, background scroll lock, inert state, and focus management
  useEffect(() => {
    if (!isOpen) {
      setVisibleClass(false);
      return undefined;
    }

    lastFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setLocalError('');
    setSuccessNotice('');
    setBusyMode('');
    submitLockRef.current = false;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const rootEl = document.getElementById('root');
    if (rootEl) {
      rootEl.setAttribute('aria-hidden', 'true');
      rootEl.inert = true;
    }

    const frame = window.requestAnimationFrame(() => {
      setVisibleClass(true);
      emailInputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = prevOverflow;
      if (rootEl) {
        rootEl.removeAttribute('aria-hidden');
        rootEl.inert = false;
      }
      if (lastFocusedRef.current && typeof lastFocusedRef.current.focus === 'function') {
        lastFocusedRef.current.focus();
      }
      lastFocusedRef.current = null;
    };
  }, [isOpen]);

  // Keyboard Escape close + Tab focus trap inside dialog
  useEffect(() => {
    if (!isOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!submitLockRef.current && !isBusy && typeof onClose === 'function') {
          onClose();
        }
        return;
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const selectors = [
          'a[href]',
          'button:not([disabled])',
          'input:not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          '[tabindex]:not([tabindex="-1"])',
        ].join(',');
        const focusables = Array.from(dialogRef.current.querySelectorAll(selectors)).filter(
          (el) => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden';
          },
        );
        if (focusables.length === 0) {
          event.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey) {
          if (document.activeElement === first || !dialogRef.current.contains(document.activeElement)) {
            event.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last || !dialogRef.current.contains(document.activeElement)) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isBusy, onClose]);

  if (!isOpen) return null;

  function finishSignIn(signedInUser) {
    const destination = resolvePostLoginPath(signedInUser, returnTo);
    const roleLabel =
      signedInUser?.role === 'admin'
        ? 'System Administrator'
        : signedInUser?.role === 'professor'
          ? 'Faculty'
          : 'Student';
    setSuccessNotice(
      `Signed in as ${signedInUser?.fullName || 'Campus User'} (${roleLabel}). Opening workspace...`,
    );
    window.setTimeout(() => {
      if (typeof onClose === 'function') {
        onClose({ authenticated: true });
      }
      navigate(destination, { replace: true });
    }, 300);
  }

  async function handleEmailSubmit(event) {
    event.preventDefault();
    if (submitLockRef.current || isBusy) return;

    const allowedDomains = authConfig.allowedDomainsConfigured ? authConfig.allowedDomains : [];
    const emailCheck = validateUniversityEmailInput(email, allowedDomains);
    if (!emailCheck.valid) {
      setLocalError(emailCheck.error);
      emailInputRef.current?.focus();
      return;
    }
    if (!password) {
      setLocalError('Please enter your university account password.');
      return;
    }

    submitLockRef.current = true;
    setLocalError('');
    setAuthError('');
    setBusyMode('email');
    try {
      const signedInUser = await signInWithEmail({ email: emailCheck.email, password });
      finishSignIn(signedInUser);
    } catch (err) {
      submitLockRef.current = false;
      setBusyMode('');
      setLocalError(err.message || 'Invalid university email or password.');
    }
  }

  async function handleGoogleSignIn() {
    if (submitLockRef.current || isBusy) return;
    submitLockRef.current = true;
    setLocalError('');
    setAuthError('');
    setBusyMode('google');
    try {
      const signedInUser = await signInWithGoogle();
      finishSignIn(signedInUser);
    } catch (err) {
      submitLockRef.current = false;
      setBusyMode('');
      const code = err?.code ? String(err.code) : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setLocalError('Google Sign-In was cancelled before completing.');
      } else {
        setLocalError(err.message || 'Google Sign-In did not complete.');
      }
    }
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget && !submitLockRef.current && !isBusy) {
      onClose?.();
    }
  }

  const displayedError = localError || authError;
  const activeBanner = successNotice
    ? { type: 'success', text: successNotice }
    : displayedError
      ? { type: 'error', text: displayedError }
      : initialNotice
        ? { type: initialNoticeType || 'info', text: initialNotice }
        : null;

  const modalNode = (
    <div
      className={`auth-modal-backdrop ${visibleClass ? 'is-open' : ''}`}
      onMouseDown={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        className="auth-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="react-auth-modal-title"
        aria-describedby="react-auth-modal-subtitle"
        tabIndex={-1}
      >
        <div className="auth-modal-topbar">
          <div className="auth-modal-brand">
            <span className="auth-modal-logo-badge">
              <img
                src="/assets/images/facicuse-logo.jpg"
                alt="FaCICuSe logo"
                className="auth-modal-logo-img"
                width={28}
                height={28}
              />
            </span>
            <span className="auth-modal-wordmark">FaCICuSe</span>
          </div>

          <button
            type="button"
            className="auth-modal-close"
            aria-label="Close sign-in dialog"
            disabled={isBusy}
            onClick={() => {
              if (!submitLockRef.current && !isBusy) onClose?.();
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="auth-modal-header">
          <span className="auth-modal-kicker">
            {PROJECT_INFO.institutionShort} · {PROJECT_INFO.collegeShort}
          </span>
          <h2 id="react-auth-modal-title" className="auth-modal-title">
            Sign in to FaCICuSe
          </h2>
          <p id="react-auth-modal-subtitle" className="auth-modal-subtitle">
            Access your role workspace to reserve CICS rooms, check live schedules, and track
            maintenance tickets.
          </p>
        </div>

        {activeBanner && (
          <div
            className={`auth-modal-alert auth-modal-alert--${activeBanner.type}`}
            role={activeBanner.type === 'error' ? 'alert' : 'status'}
          >
            {activeBanner.type === 'success' ? (
              <CheckCircle2 size={17} aria-hidden="true" />
            ) : activeBanner.type === 'info' ? (
              <Info size={17} aria-hidden="true" />
            ) : (
              <ShieldAlert size={17} aria-hidden="true" />
            )}
            <span>{activeBanner.text}</span>
          </div>
        )}

        <form className="auth-modal-form" onSubmit={handleEmailSubmit} noValidate>
          <div className="auth-modal-field">
            <label htmlFor="react-auth-modal-email" className="auth-modal-label">
              University Email
            </label>
            <input
              ref={emailInputRef}
              id="react-auth-modal-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              disabled={isBusy}
              className="auth-modal-input"
              placeholder={`name@${authConfig.allowedDomains?.[0] || 'g.batstate-u.edu.ph'}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="auth-modal-field">
            <label htmlFor="react-auth-modal-password" className="auth-modal-label">
              Password
            </label>
            <div className="auth-modal-input-wrap">
              <input
                id="react-auth-modal-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                disabled={isBusy}
                className="auth-modal-input auth-modal-input--password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="auth-modal-eye-btn"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                disabled={isBusy}
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
              </button>
            </div>
          </div>

          <button type="submit" className="auth-modal-submit" disabled={isBusy}>
            {busyMode === 'email' ? (
              <>
                <span className="auth-modal-spinner" aria-hidden="true" />
                <span>Signing In...</span>
              </>
            ) : (
              <span>Sign In with University Email</span>
            )}
          </button>
        </form>

        <div className="auth-modal-divider" aria-hidden="true">
          or continue with
        </div>

        <button
          type="button"
          className="auth-modal-google-btn"
          disabled={isBusy}
          onClick={handleGoogleSignIn}
        >
          {busyMode === 'google' ? (
            <span className="auth-modal-spinner" aria-hidden="true" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
              />
              <path
                fill="#34A853"
                d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z"
              />
              <path
                fill="#EA4335"
                d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
              />
            </svg>
          )}
          <span>
            {busyMode === 'google'
              ? 'Verifying Google Account...'
              : 'Sign In with University Google Account'}
          </span>
        </button>

        {authConfig.allowedDomainsConfigured && authConfig.allowedDomains?.length > 0 && (
          <p className="auth-modal-footnote">
            Verified university domains:{' '}
            <strong>{authConfig.allowedDomains.join(', ')}</strong>.
          </p>
        )}
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalNode, document.body);
  }
  return modalNode;
}
