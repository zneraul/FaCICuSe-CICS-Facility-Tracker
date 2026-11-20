import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useAuthModal } from '../context/AuthModalContext.jsx';
import { PROJECT_INFO } from '../../server/domain/projectInfo.js';

export function PublicLayout({ children }) {
  const { user, logout } = useAuth();
  const { openSignInModal } = useAuthModal();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const isFacilitiesActive = location.pathname.startsWith('/facilities') || (location.pathname === '/' && location.hash === '#facilities');
  const isTimetableActive = location.pathname.startsWith('/timetable');
  useEffect(() => {
    if (location.pathname !== '/') return undefined;

    const frame = window.requestAnimationFrame(() => {
      if (!location.hash) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const sectionId = decodeURIComponent(location.hash.slice(1));
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, location.hash]);

  const handleHomeClick = () => {
    setMobileMenuOpen(false);
    setAccountMenuOpen(false);
    if (location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="ambient-canvas">
      <div className="ambient-backdrop" aria-hidden="true" />
      <div className="ambient-scrim" aria-hidden="true" />

      <header className="public-header">
        <div className="public-header-inner">
          <Link to="/" className="brand-lockup" onClick={handleHomeClick}>
            <span className="brand-logo-badge">
              <img
                src="/assets/images/facicuse-logo.jpg"
                alt="FaCICuSe logo"
                className="brand-logo-img"
                style={{ width: '28px', height: '28px' }}
              />
            </span>
            <span className="brand-wordmark">FaCICuSe</span>
          </Link>

          <nav className="public-nav-links" aria-label="Primary navigation">
            <Link to="/" className="public-nav-link" onClick={handleHomeClick}>
              Home
            </Link>
            <Link
              to="/#facilities"
              className={`public-nav-link ${isFacilitiesActive ? 'active' : ''}`}
              aria-current={isFacilitiesActive ? 'location' : undefined}
              onClick={() => {
                setMobileMenuOpen(false);
                setAccountMenuOpen(false);
              }}
            >
              Facilities
            </Link>
            <Link to="/#reservations" className="public-nav-link">
              Availability
            </Link>
            <Link to="/#about" className="public-nav-link">
              How It Works
            </Link>
            <Link to="/#faq" className="public-nav-link">
              FAQ
            </Link>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
            {user ? (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="btn btn-coral btn-sm"
                  aria-haspopup="menu"
                  aria-expanded={accountMenuOpen}
                  onClick={() => setAccountMenuOpen((open) => !open)}
                >
                  {user.fullName || 'My Account'}
                  <span aria-hidden="true" style={{ marginLeft: '0.4rem' }}>▾</span>
                </button>
                {accountMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Account navigation"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 0.5rem)',
                      right: 0,
                      zIndex: 30,
                      minWidth: '190px',
                      padding: '0.45rem',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '12px',
                      background: 'var(--surface-elevated, #ffffff)',
                      boxShadow: '0 12px 32px rgba(15, 23, 42, 0.16)',
                    }}
                  >
                    <div style={{ padding: '0.55rem 0.65rem', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 650, color: 'var(--ink-primary)' }}>
                        {user.fullName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                        {user.role === 'admin' ? 'System Administrator' : user.role === 'professor' ? 'Faculty Member' : 'Student'}
                      </div>
                    </div>
                    <Link
                      to="/app/profile"
                      role="menuitem"
                      className="public-mobile-link"
                      style={{ display: 'block', marginTop: '0.25rem' }}
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      Profile
                    </Link>
                    <Link
                      to="/app/dashboard"
                      role="menuitem"
                      className="public-mobile-link"
                      style={{ display: 'block' }}
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      Open Workspace
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      className="public-mobile-link"
                      style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, background: 'transparent', cursor: 'pointer' }}
                      onClick={async () => {
                        setAccountMenuOpen(false);
                        await logout();
                      }}
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-coral btn-sm"
                onClick={() => openSignInModal()}
              >
                Sign In
              </button>
            )}

            <button
              type="button"
              className="icon-btn public-mobile-toggle"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="public-mobile-menu"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
            >
              {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav
            id="public-mobile-menu"
            className="public-mobile-drawer"
            aria-label="Mobile section navigation"
          >
            <Link to="/" className="public-mobile-link" onClick={handleHomeClick}>
              Home
            </Link>
            <Link
              to="/#facilities"
              className={`public-mobile-link ${isFacilitiesActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Facilities
            </Link>
            <Link to="/#reservations" className="public-mobile-link" onClick={() => setMobileMenuOpen(false)}>
              Availability
            </Link>
            <Link to="/#about" className="public-mobile-link" onClick={() => setMobileMenuOpen(false)}>
              How It Works
            </Link>
            <Link to="/#faq" className="public-mobile-link" onClick={() => setMobileMenuOpen(false)}>
              FAQ
            </Link>
            {user ? (
              <>
                <Link to="/app/profile" className="public-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                  Profile
                </Link>
                <Link to="/app/dashboard" className="public-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                  Open Workspace
                </Link>
                <button
                  type="button"
                  className="public-mobile-link"
                  style={{ background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', width: '100%' }}
                  onClick={async () => {
                    setMobileMenuOpen(false);
                    await logout();
                  }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                type="button"
                className="public-mobile-link"
                style={{
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                }}
                onClick={() => {
                  setMobileMenuOpen(false);
                  openSignInModal();
                }}
              >
                Sign In
              </button>
            )}
          </nav>
        )}
      </header>

      <main className="public-main">{children}</main>

      <footer id="contact" className="public-footer" style={{ scrollMarginTop: '5.5rem' }}>
        <div className="public-footer-inner">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <Link to="/" className="brand-lockup" onClick={handleHomeClick}>
              <span className="brand-logo-badge">
                <img
                  src="/assets/images/facicuse-logo.jpg"
                  alt="FaCICuSe logo"
                  className="brand-logo-img"
                  style={{ width: '28px', height: '28px' }}
                />
              </span>
              <span className="brand-wordmark">FaCICuSe</span>
            </Link>
            <p style={{ fontSize: '0.88rem', color: 'var(--ink-secondary)', maxWidth: '34ch' }}>
              <strong>{PROJECT_INFO.meaning}</strong> — {PROJECT_INFO.tagline}.
            </p>
            <address style={{ fontStyle: 'normal', fontSize: '0.82rem', color: 'var(--ink-muted)', lineHeight: 1.6 }}>
              {PROJECT_INFO.college}
              <br />
              {PROJECT_INFO.institutionShort}
              <br />
              {PROJECT_INFO.campusAddress}
              <br />
              Email:{' '}
              <a href={`mailto:${PROJECT_INFO.contactEmail}`} style={{ color: 'var(--accent-blue)' }}>
                {PROJECT_INFO.contactEmail}
              </a>
            </address>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.42rem', fontSize: '0.86rem', color: 'var(--ink-secondary)' }}>
            <strong style={{ fontSize: '0.85rem', color: 'var(--ink-primary)' }}>Quick Links</strong>
            <Link to="/" onClick={handleHomeClick}>Homepage</Link>
            <Link to="/facilities">CICS Directory (38 Spaces)</Link>
            <Link to="/timetable">Class Timetable</Link>
            <a href="/#reservations">Live Availability</a>
            <a href="/#faq">FAQ</a>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.42rem', fontSize: '0.86rem', color: 'var(--ink-secondary)' }}>
            <strong style={{ fontSize: '0.85rem', color: 'var(--ink-primary)' }}>Campus Access</strong>
            {user ? (
              <Link to="/app/dashboard">Open Workspace</Link>
            ) : (
              <button
                type="button"
                onClick={() => openSignInModal()}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  textAlign: 'left',
                  color: 'inherit',
                  font: 'inherit',
                  cursor: 'pointer',
                }}
              >
                University Sign In
              </button>
            )}
            <Link to="/app/dashboard">Authenticated Workspace</Link>
            <span style={{ color: 'var(--ink-muted)', marginTop: '0.4rem', fontSize: '0.8rem' }}>
              {PROJECT_INFO.copyright}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
