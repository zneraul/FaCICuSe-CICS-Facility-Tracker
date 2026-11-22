import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { AuthModalProvider } from './context/AuthModalContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { LandingPage } from './pages/LandingPage.jsx';
import { FacilitiesDirectoryPage } from './pages/FacilitiesDirectoryPage.jsx';
import { FacilityDetailPage } from './pages/FacilityDetailPage.jsx';
import { PublicTimetablePage } from './pages/PublicTimetablePage.jsx';
import { SignInPage } from './pages/SignInPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { CalendarPage } from './pages/CalendarPage.jsx';
import { ReservationsPage } from './pages/ReservationsPage.jsx';
import { IssuesPage } from './pages/IssuesPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { AdminFacilitiesPage } from './pages/AdminFacilitiesPage.jsx';
import { AdminReservationsPage } from './pages/AdminReservationsPage.jsx';
import { AdminSchedulesPage } from './pages/AdminSchedulesPage.jsx';
import { AdminMaintenancePage } from './pages/AdminMaintenancePage.jsx';
import { AdminUsersPage } from './pages/AdminUsersPage.jsx';
import { AdminAnalyticsPage } from './pages/AdminAnalyticsPage.jsx';

function ProtectedRoute({ children }) {
  const { user, loading, sessionExpired } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="ambient-canvas" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div className="ambient-backdrop" aria-hidden="true" />
        <div className="ambient-scrim" aria-hidden="true" />
        <div className="glass-panel">Verifying session...</div>
      </div>
    );
  }
  if (!user) {
    return (
      <Navigate
        to={sessionExpired ? '/signin?expired=1' : '/signin'}
        state={{ from: location.pathname + location.search, expired: sessionExpired }}
        replace
      />
    );
  }
  return children;
}

function AdminOnlyRoute({ children }) {
  const { user, loading, sessionExpired } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="ambient-canvas" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div className="ambient-backdrop" aria-hidden="true" />
        <div className="ambient-scrim" aria-hidden="true" />
        <div className="glass-panel">Verifying administrator permissions...</div>
      </div>
    );
  }
  if (!user) {
    return (
      <Navigate
        to={sessionExpired ? '/signin?expired=1' : '/signin'}
        state={{ from: location.pathname + location.search, expired: sessionExpired }}
        replace
      />
    );
  }
  if (user.role !== 'admin') {
    return <Navigate to="/app/dashboard" replace />;
  }
  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AuthModalProvider>
            <NotificationProvider>
              <Routes>
                {/* Public Website Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/facilities" element={<FacilitiesDirectoryPage authenticated={false} />} />
                <Route path="/facilities/:id" element={<FacilityDetailPage authenticated={false} />} />
                <Route path="/timetable" element={<PublicTimetablePage />} />
                <Route path="/signin" element={<SignInPage />} />

          {/* Authenticated Campus Workspace Routes */}
          <Route
            path="/app/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/facilities"
            element={
              <ProtectedRoute>
                <FacilitiesDirectoryPage authenticated />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/facilities/:id"
            element={
              <ProtectedRoute>
                <FacilityDetailPage authenticated />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/calendar"
            element={
              <ProtectedRoute>
                <CalendarPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/reservations"
            element={
              <ProtectedRoute>
                <ReservationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/issues"
            element={
              <ProtectedRoute>
                <IssuesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* System Administrator Routes (Strictly Admin-Only) */}
          <Route
            path="/app/admin/facilities"
            element={
              <AdminOnlyRoute>
                <AdminFacilitiesPage />
              </AdminOnlyRoute>
            }
          />
          <Route
            path="/app/admin/reservations"
            element={
              <AdminOnlyRoute>
                <AdminReservationsPage />
              </AdminOnlyRoute>
            }
          />
          <Route
            path="/app/admin/schedules"
            element={
              <AdminOnlyRoute>
                <AdminSchedulesPage />
              </AdminOnlyRoute>
            }
          />
          <Route
            path="/app/admin/maintenance"
            element={
              <AdminOnlyRoute>
                <AdminMaintenancePage />
              </AdminOnlyRoute>
            }
          />
          <Route
            path="/app/admin/users"
            element={
              <AdminOnlyRoute>
                <AdminUsersPage />
              </AdminOnlyRoute>
            }
          />
          <Route
            path="/app/admin/analytics"
            element={
              <AdminOnlyRoute>
                <AdminAnalyticsPage />
              </AdminOnlyRoute>
            }
          />

            <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </NotificationProvider>
          </AuthModalProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
