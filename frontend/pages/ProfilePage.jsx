import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, Info } from 'lucide-react';
import { AppShell } from '../components/AppShell.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  formatNotificationTime,
  useNotifications,
} from '../context/NotificationContext.jsx';
import { apiRequest } from '../services/api.js';

export function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
  } = useNotifications();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [academicBlock, setAcademicBlock] = useState(user?.academicBlock || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setFullName(user?.fullName || '');
    setDepartment(user?.department || '');
    setAcademicBlock(user?.academicBlock || '');
    refreshNotifications();
  }, [user, refreshNotifications]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await apiRequest('/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName,
          department,
          academicBlock: academicBlock.trim() || null,
        }),
      });
      await refreshProfile();
      setMessage('Profile updated.');
    } catch (err) {
      setError(err.message || 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  }

  async function handleNotificationClick(item) {
    if (!item.isRead) {
      await markAsRead(item.id);
    }
    if (item.linkPath) {
      navigate(item.linkPath);
    }
  }

  function renderIcon(type) {
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

  return (
    <AppShell title="Account Profile">
      <div className="two-col-grid">
        <section className="glass-panel" aria-label="Profile settings">
          <h2 style={{ fontSize: '1.2rem', marginBottom: '0.35rem' }}>Account Details</h2>
          <div className="meta-line" style={{ marginBottom: '1rem' }}>
            <span style={{ overflowWrap: 'anywhere' }}>{user?.email}</span>
            <span aria-hidden="true">·</span>
            <span>
              Role:{' '}
              {user?.role === 'admin'
                ? 'System Administrator'
                : user?.role === 'professor'
                  ? 'Professor'
                  : 'Student'}
            </span>
          </div>

          {error && (
            <div className="alert-banner alert-error" role="alert" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}
          {message && (
            <div className="alert-banner alert-success" role="status" style={{ marginBottom: '1rem' }}>
              {message}
            </div>
          )}

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
            <div className="field-group">
              <label htmlFor="prof-name" className="field-label">
                Full Name
              </label>
              <input
                id="prof-name"
                type="text"
                className="field-input"
                required
                minLength={2}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label htmlFor="prof-dept" className="field-label">
                Department or College
              </label>
              <input
                id="prof-dept"
                type="text"
                className="field-input"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label htmlFor="prof-block" className="field-label">
                Academic Block / Section (Optional)
              </label>
              <input
                id="prof-block"
                type="text"
                className="field-input"
                maxLength={12}
                placeholder="e.g. IT-1109, IT-2109, IT-3106, IT-4106 (leave blank if N/A)"
                value={academicBlock}
                onChange={(e) => setAcademicBlock(e.target.value.toUpperCase())}
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                Format: IT-&lt;Year 1-4&gt;&lt;Sem 1-2&gt;&lt;2-digit block&gt;. Leave blank if not assigned to a section.
              </span>
            </div>

            <button type="submit" className="btn btn-coral" disabled={saving}>
              {saving ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </form>
        </section>

        <section className="glass-panel" aria-label="Notification log">
          <div className="profile-notif-header">
            <div>
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Recent Notifications</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </span>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="btn btn-glass btn-sm"
                onClick={markAllAsRead}
              >
                <CheckCheck size={14} aria-hidden="true" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="notif-empty-state" style={{ padding: '1.75rem 0.75rem' }}>
              <Bell size={20} aria-hidden="true" style={{ color: 'var(--ink-muted)' }} />
              <span>No notifications yet.</span>
            </div>
          ) : (
            <div className="notif-list">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleNotificationClick(n)}
                  className={`notif-item ${n.isRead ? 'is-read' : 'is-unread'}`}
                >
                  {renderIcon(n.type)}
                  <div className="notif-item-content">
                    <div className="notif-item-top">
                      <span className="notif-item-title">{n.title}</span>
                      <span className="notif-item-status">
                        {!n.isRead && <span className="notif-unread-dot" aria-hidden="true" />}
                        <span>{n.isRead ? 'Read' : 'Unread'}</span>
                      </span>
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
        </section>
      </div>
    </AppShell>
  );
}
