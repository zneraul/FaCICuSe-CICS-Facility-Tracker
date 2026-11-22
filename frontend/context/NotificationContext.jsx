import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { apiRequest } from '../services/api.js';

const NotificationContext = createContext(null);

export function formatNotificationTime(isoTimestamp) {
  if (!isoTimestamp) return '';
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refreshNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setError('');
      return [];
    }
    setLoading(true);
    try {
      const res = await apiRequest('/notifications');
      const items = Array.isArray(res.notifications) ? res.notifications : [];
      setNotifications(items);
      setError('');
      return items;
    } catch (err) {
      setError(err.message || 'Unable to load notifications.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setError('');
      return;
    }
    refreshNotifications();

    const handleDirty = () => {
      refreshNotifications();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshNotifications();
      }
    };

    window.addEventListener('facicuse:notifications-dirty', handleDirty);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('facicuse:notifications-dirty', handleDirty);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user, refreshNotifications]);

  const markAsRead = useCallback(async (notificationId) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
    );
    try {
      await apiRequest(`/notifications/${notificationId}/read`, { method: 'PATCH' });
    } catch {
      // Keep UI responsive; next refresh will reconcile
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await apiRequest('/notifications/all/read', { method: 'PATCH' });
    } catch {
      // Keep UI responsive; next refresh will reconcile
    }
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        error,
        refreshNotifications,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used inside NotificationProvider');
  }
  return ctx;
}
