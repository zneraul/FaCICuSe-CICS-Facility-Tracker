import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  Info,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  UserCircle2,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  formatNotificationTime,
  useNotifications,
} from '../context/NotificationContext.jsx';

function NotificationTypeIcon({ type }) {
  if (type === 'success') {
    return (
      <span className="notif-type-icon notif-type-success" aria-hidden="true">
        <CheckCircle2 size={16} />
      </span>
    );
  }
  if (type === 'warning' || type === 'error') {
    return (
      <span className="notif-type-icon notif-type-warning" aria-hidden="true">
        <AlertTriangle size={16} />
      </span>
    );
  }
  return (
    <span className="notif-type-icon notif-type-info" aria-hidden="true">
      <Info size={16} />
    </span>
  );
}

export function AppShell({ title, primaryAction, children }) {
  const { user, logout } = useAuth();
  const {
    notifications,
    unreadCount,
    loading: notifLoading,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 880px)').matches : false,
  );
  const notifContainerRef = useRef(null);
  const notifPanelRef = useRef(null);
  const notifButtonRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(max-width: 880px)');
    const handleChange = (event) => setIsCompactViewport(event.matches);
    setIsCompactViewport(mq.matches);
    if (mq.addEventListener) {
      mq.addEventListener('change', handleChange);
      return () => mq.removeEventListener('change', handleChange);
    }
    mq.addListener(handleChange);
    return () => mq.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [sidebarOpen]);

  useEffect(() => {
    if (!notifOpen) return undefined;
    refreshNotifications();

    function handlePointerDown(event) {
      const target = event.target;
      const inTrigger = notifContainerRef.current && notifContainerRef.current.contains(target);
      const inPanel = notifPanelRef.current && notifPanelRef.current.contains(target);
      if (!inTrigger && !inPanel) {
        setNotifOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setNotifOpen(false);
        notifButtonRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('keydown', handleKeyDown);

    const prevOverflow = document.body.style.overflow;
    if (isCompactViewport) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      if (isCompactViewport) {
        document.body.style.overflow = prevOverflow;
      }
    };
  }, [notifOpen, isCompactViewport, refreshNotifications]);

  async function handleMarkAllRead() {
    await markAllAsRead();
  }

  async function handleMarkRead(item) {
    if (!item.isRead) {
      await markAsRead(item.id);
    }
    setNotifOpen(false);
    if (item.linkPath) {
      navigate(item.linkPath);
    }
  }

  async function handleLogout() {
    setNotifOpen(false);
    navigate('/', { replace: true });
    await logout();
  }

  const isAdmin = user?.role === 'admin';
  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

  // Streamlined 5 core workflow links (Profile sits cleanly in user card & topbar)
  const coreLinks = [
    { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/app/facilities', label: 'Browse Spaces', icon: Building2 },
    { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
    { to: '/app/reservations', label: 'My Bookings', icon: CalendarCheck2 },
    { to: '/app/issues', label: 'Maintenance', icon: Wrench },
  ];

  const adminLinks = isAdmin
    ? [
        { to: '/app/admin/reservations', label: 'Review Requests', icon: ClipboardList },
        { to: '/app/admin/schedules', label: 'Class Schedules', icon: CalendarRange },
        { to: '/app/admin/facilities', label: 'Manage Spaces', icon: ShieldCheck },
        { to: '/app/admin/maintenance', label: 'Triage Issues', icon: Wrench },
        { to: '/app/admin/users', label: 'User Accounts', icon: Users },
        { to: '/app/admin/analytics', label: 'Analytics', icon: BarChart3 },
      ]
    : [];

  return (
    <div className="ambient-canvas">
      <div className="ambient-backdrop" aria-hidden="true" />
      <div className="ambient-scrim" aria-hidden="true" />

      {sidebarOpen && (
        <div
          className="sidebar-mobile-backdrop"
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="app-shell">
        <aside
          className={`app-sidebar ${sidebarOpen ? 'mobile-open' : ''}`}
          aria-label="Workspace navigation"
        >
          <div style={{ overflowY: 'auto' }}>
            <div className="sidebar-brand">
              <a href="/" className="brand-lockup" onClick={() => setSidebarOpen(false)} aria-label="Return to the public FaCICuSe homepage">
                <span className="brand-logo-badge">
                  <img
                    src="/assets/images/facicuse-logo.jpg"
                    alt="FaCICuSe logo"
                    className="brand-logo-img"
                    style={{ width: '28px', height: '28px' }}
                  />
                </span>
                <span className="sidebar-brand-title">FaCICuSe</span>
              </a>
              <button
                type="button"
                className="mobile-only-btn icon-btn"
                style={{ width: '36px', height: '36px' }}
                onClick={() => setSidebarOpen(false)}
                aria-label="Close navigation menu"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="sidebar-nav-group" aria-label="Campus workspace">
              <span className="sidebar-section-label">Workspace</span>
              {coreLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            {isAdmin && (
              <nav className="sidebar-nav-group" aria-label="Administration">
                <span className="sidebar-section-label">Administration</span>
                {adminLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
            )}
          </div>

          <div className="sidebar-footer">
            <Link
              to="/app/profile"
              onClick={() => setSidebarOpen(false)}
              style={{
                display: 'block',
                padding: '0.55rem 0.7rem',
                borderRadius: '10px',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--ink-primary)' }}>
                {user?.fullName}
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--ink-muted)' }}>
                {user?.role === 'admin'
                  ? 'System Administrator'
                  : user?.role === 'professor'
                    ? 'Professor'
                    : 'Student'}
              </div>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="sidebar-link"
              style={{ border: 'none', background: 'transparent', width: '100%', textAlign: 'left', cursor: 'pointer' }}
            >
              <LogOut size={18} aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        <div className="app-workspace">
          <header className="app-topbar">
            <div className="app-topbar-left">
              <button
                type="button"
                className="mobile-only-btn icon-btn"
                onClick={() => {
                  setNotifOpen(false);
                  setSidebarOpen(true);
                }}
                aria-label="Open navigation menu"
              >
                <Menu size={19} />
              </button>
              <h1 className="app-topbar-title">{title}</h1>
            </div>

            <div className="app-topbar-actions">
              <div className="popover-anchor" ref={notifContainerRef}>
                <button
                  ref={notifButtonRef}
                  type="button"
                  className={`icon-btn ${notifOpen ? 'is-active' : ''}`}
                  aria-label={`Notifications (${unreadCount} unread)`}
                  aria-expanded={notifOpen}
                  aria-haspopup="dialog"
                  aria-controls="facicuse-notifications-panel"
                  onClick={() => setNotifOpen((prev) => !prev)}
                >
                  <Bell size={18} aria-hidden="true" />
                  {unreadCount > 0 && (
                    <span className="notif-count-badge" aria-hidden="true">
                      {badgeText}
                    </span>
                  )}
                </button>

                {notifOpen &&
                  (() => {
                    const panelContent = (
                      <>
                        {isCompactViewport && (
                          <div
                            className="notif-backdrop"
                            aria-hidden="true"
                            onClick={() => setNotifOpen(false)}
                          />
                        )}
                        <div
                          ref={notifPanelRef}
                          id="facicuse-notifications-panel"
                          className="popover-panel"
                          role="dialog"
                          aria-modal={isCompactViewport ? 'true' : undefined}
                          aria-label="Notifications"
                        >
                          <div className="notif-panel-header">
                            <div className="notif-panel-title-group">
                              <strong className="notif-panel-title">Notifications</strong>
                              {unreadCount > 0 && (
                                <span className="notif-unread-meta">{unreadCount} unread</span>
                              )}
                            </div>
                            <div className="notif-panel-controls">
                              {unreadCount > 0 && (
                                <button
                                  type="button"
                                  className="btn btn-glass btn-sm notif-mark-all-btn"
                                  onClick={handleMarkAllRead}
                                >
                                  <CheckCheck size={14} aria-hidden="true" />
                                  <span>Mark all read</span>
                                </button>
                              )}
                              <button
                                type="button"
                                className="icon-btn notif-close-btn"
                                aria-label="Close notifications"
                                onClick={() => setNotifOpen(false)}
                              >
                                <X size={16} aria-hidden="true" />
                              </button>
                            </div>
                          </div>

                          <div className="notif-panel-body">
                            {notifLoading && notifications.length === 0 ? (
                              <div className="notif-empty-state">Loading notifications...</div>
                            ) : notifications.length === 0 ? (
                              <div className="notif-empty-state">
                                <Bell size={20} aria-hidden="true" style={{ color: 'var(--ink-muted)' }} />
                                <span>No notifications recorded yet.</span>
                              </div>
                            ) : (
                              <div className="notif-list">
                                {notifications.slice(0, 10).map((n) => (
                                  <button
                                    key={n.id}
                                    type="button"
                                    onClick={() => handleMarkRead(n)}
                                    className={`notif-item ${n.isRead ? 'is-read' : 'is-unread'}`}
                                  >
                                    <NotificationTypeIcon type={n.type} />
                                    <div className="notif-item-content">
                                      <div className="notif-item-top">
                                        <span className="notif-item-title">{n.title}</span>
                                        {!n.isRead && (
                                          <span className="notif-unread-dot" aria-label="Unread" />
                                        )}
                                      </div>
                                      <p className="notif-item-message">{n.message}</p>
                                      {n.createdAt && (
                                        <span className="notif-item-time">
                                          {formatNotificationTime(n.createdAt)}
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="notif-panel-footer">
                            <Link
                              to="/app/profile"
                              className="notif-footer-link"
                              onClick={() => setNotifOpen(false)}
                            >
                              View full notification history
                            </Link>
                          </div>
                        </div>
                      </>
                    );

                    return isCompactViewport && typeof document !== 'undefined'
                      ? createPortal(panelContent, document.body)
                      : panelContent;
                  })()}
              </div>

              <Link
                to="/app/profile"
                className="btn btn-glass btn-sm topbar-profile-link"
                aria-label="Account profile"
              >
                <UserCircle2 size={17} aria-hidden="true" />
                <span>{user?.fullName?.split(' ')[0] || 'Profile'}</span>
              </Link>
            </div>
          </header>

          <main className="app-content">{children}</main>
        </div>
      </div>

      {/* Responsive Mobile Bottom Navigation Bar */}
      <nav className="mobile-v10-bar" aria-label="Mobile workspace tabs">
        <NavLink
          to="/app/dashboard"
          className={({ isActive }) => `mobile-v10-link ${isActive ? 'active' : ''}`}
        >
          <LayoutDashboard size={16} aria-hidden="true" />
          <span>Home</span>
        </NavLink>
        <NavLink
          to="/app/facilities"
          className={({ isActive }) => `mobile-v10-link ${isActive ? 'active' : ''}`}
        >
          <Building2 size={16} aria-hidden="true" />
          <span>Spaces</span>
        </NavLink>
        <NavLink
          to="/app/calendar"
          className={({ isActive }) => `mobile-v10-link ${isActive ? 'active' : ''}`}
        >
          <CalendarDays size={16} aria-hidden="true" />
          <span>Calendar</span>
        </NavLink>
        <NavLink
          to="/app/reservations"
          className={({ isActive }) => `mobile-v10-link ${isActive ? 'active' : ''}`}
        >
          <CalendarCheck2 size={16} aria-hidden="true" />
          <span>Bookings</span>
        </NavLink>
        <NavLink
          to="/app/issues"
          className={({ isActive }) => `mobile-v10-link ${isActive ? 'active' : ''}`}
        >
          <Wrench size={16} aria-hidden="true" />
          <span>Issues</span>
        </NavLink>
        {isAdmin && (
          <NavLink
            to="/app/admin/analytics"
            className={({ isActive }) => `mobile-v10-link ${isActive ? 'active' : ''}`}
          >
            <BarChart3 size={16} aria-hidden="true" />
            <span>Admin</span>
          </NavLink>
        )}
      </nav>
    </div>
  );
}
