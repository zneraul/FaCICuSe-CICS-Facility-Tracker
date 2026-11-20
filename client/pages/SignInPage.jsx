import React from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { LandingPage } from './LandingPage.jsx';
import { SignInModal } from '../components/SignInModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { resolvePostLoginPath } from '../utils/authRedirect.js';

/**
 * Preserved /signin route for direct links and protected-route redirects.
 * Renders the exact same glassmorphism SignInModal directly over the public homepage
 * so authentication never feels like an unrelated standalone screen.
 */
export function SignInPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const requestedReturnTo =
    location.state?.from || searchParams.get('from') || '/app/dashboard';

  if (user) {
    return <Navigate to={resolvePostLoginPath(user, requestedReturnTo)} replace />;
  }

  const isExpired =
    searchParams.get('expired') === '1' || location.state?.expired === true;
  const protectedRedirectNotice =
    location.state?.from && !isExpired
      ? 'Please sign in with your university account to continue to your workspace.'
      : '';

  const initialNotice = isExpired
    ? 'Your session has expired. Please sign in again to continue.'
    : protectedRedirectNotice;
  const initialNoticeType = isExpired ? 'error' : 'info';

  function handleClose(meta) {
    if (meta?.authenticated) return;
    if (typeof window !== 'undefined') {
      window.location.assign('/');
    } else {
      navigate('/', { replace: true });
    }
  }

  return (
    <>
      <LandingPage />
      <SignInModal
        isOpen
        onClose={handleClose}
        returnTo={requestedReturnTo}
        initialNotice={initialNotice}
        initialNoticeType={initialNoticeType}
      />
    </>
  );
}
