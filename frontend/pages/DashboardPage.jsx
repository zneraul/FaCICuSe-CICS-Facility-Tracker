import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  MapPin,
  Search,
  Wrench,
  X,
} from 'lucide-react';
import { AppShell } from '../components/AppShell.jsx';
import { apiRequest } from '../services/api.js';
import {
  CLASS_SCHEDULES_DIRTY_EVENT,
  VERIFICATION_STATUS,
  formatTimeRange,
  formatVerificationLabel,
} from '../utils/classScheduleUtils.js';

const FLOORS = ['All Floors', 'First Floor', 'Second Floor', 'Third Floor', 'Fourth Floor', 'Fifth Floor'];

export function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Role-tailored action panel state
  const [quickRooms, setQuickRooms] = useState([]);
  const [roomSearch, setRoomSearch] = useState('');
  const [roomFloor, setRoomFloor] = useState('All Floors');
  const [pendingQueue, setPendingQueue] = useState([]);
  const [queueBusyId, setQueueBusyId] = useState(null);
  const [queueMsg, setQueueMsg] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest('/dashboard');
      setData(res);
      if (res?.user?.role === 'admin') {
        const qRes = await apiRequest('/admin/reservations?status=Pending').catch(() => ({
          reservations: [],
        }));
        setPendingQueue(qRes.reservations || []);
      } else {
        const fRes = await apiRequest('/facilities?category=Learning').catch(() => ({
          facilities: [],
        }));
        setQuickRooms((fRes.facilities || []).filter((f) => f.isReservable !== false));
      }
    } catch (err) {
      setError(err.message || 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const handleDirty = () => loadDashboard();
    window.addEventListener(CLASS_SCHEDULES_DIRTY_EVENT, handleDirty);
    return () => window.removeEventListener(CLASS_SCHEDULES_DIRTY_EVENT, handleDirty);
  }, [loadDashboard]);

  async function handleQuickDecision(resId, decision) {
    setQueueBusyId(resId);
    setQueueMsg('');
    try {
      await apiRequest(`/admin/reservations/${resId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status: decision, reviewNote: '' }),
      });
      setQueueMsg(`Reservation #${resId} marked ${decision}.`);
      await loadDashboard();
    } catch (err) {
      setQueueMsg(err.message || 'Could not process reservation.');
    } finally {
      setQueueBusyId(null);
    }
  }

  const primaryAction = (
    <Link to="/app/facilities" className="btn btn-coral btn-sm">
      <CalendarPlus size={16} aria-hidden="true" />
      <span>New Reservation</span>
    </Link>
  );

  if (loading) {
    return (
      <AppShell title="Dashboard" primaryAction={primaryAction}>
        <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center' }}>
          Loading your campus workspace...
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell title="Dashboard" primaryAction={primaryAction}>
        <div className="alert-banner alert-error" role="alert">
          {error || 'Dashboard data unavailable.'}
        </div>
      </AppShell>
    );
  }

  const { user, metrics, recentIssues, todaysClassSchedule } = data;
  const isAdmin = user.role === 'admin';
  const todayClasses = todaysClassSchedule?.schedules || [];
  const todayWeekday = todaysClassSchedule?.weekday || '';
  const todayManilaDate = todaysClassSchedule?.manilaDate || '';
  const isNonInstructionalToday = Boolean(todaysClassSchedule?.isNonInstructionalDay);
  const roleLabel =
    user.role === 'admin'
      ? 'System Administrator'
      : user.role === 'professor'
        ? 'Faculty Member'
        : 'Student';

  const filteredQuickRooms = quickRooms
    .filter((room) => {
      if (roomFloor !== 'All Floors' && room.floor !== roomFloor) return false;
      if (roomSearch.trim()) {
        const q = roomSearch.trim().toLowerCase();
        return (
          String(room.name || '').toLowerCase().includes(q) ||
          String(room.code || '').toLowerCase().includes(q)
        );
      }
      return true;
    })
    .slice(0, 6);

  return (
    <AppShell title="Dashboard" primaryAction={primaryAction}>
      {/* 1. Compact Welcome & Action Strip */}
      <section className="v24-hero-card" aria-label="Workspace overview">
        <div>
          <div style={{ fontSize: '0.82rem', color: 'rgba(239, 246, 255, 0.88)', marginBottom: '0.25rem' }}>
            {roleLabel} · {user.department || 'CICS Building'}
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff' }}>
            Welcome back, {user.fullName}
          </h2>
          <p className="v24-hero-sub" style={{ marginTop: '0.3rem' }}>
            {isAdmin
              ? 'Review pending CICS room requests, coordinate floor availability, and triage open facility tickets.'
              : 'Find open CICS classrooms or labs, inspect schedules, and track your booking status.'}
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
          {isAdmin ? (
            <>
              <Link to="/app/admin/reservations" className="btn btn-on-coral btn-sm">
                <span>Full Approval Queue</span>
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link
                to="/app/admin/analytics"
                className="btn btn-sm"
                style={{
                  background: 'rgba(255,255,255,0.16)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.34)',
                }}
              >
                Utilization Analytics
              </Link>
            </>
          ) : (
            <>
              <Link to="/app/calendar" className="btn btn-on-coral btn-sm">
                <CalendarDays size={15} aria-hidden="true" />
                <span>Open Calendar</span>
              </Link>
              <Link
                to="/app/issues"
                className="btn btn-sm"
                style={{
                  background: 'rgba(255,255,255,0.16)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.34)',
                }}
              >
                <Wrench size={15} aria-hidden="true" />
                <span>Report Issue</span>
              </Link>
            </>
          )}
        </div>
      </section>

      {/* 2. Single Unified 4-Stat Strip */}
      <section className="stats-row" aria-label="Workspace metrics">
        <div className="stat-card">
          <span className="stat-card-label">Available CICS Spaces</span>
          <span className="stat-card-value">{metrics.availableFacilitiesCount}</span>
          <span className="stat-card-foot">
            Out of <span className="tabular">{metrics.totalFacilitiesCount}</span> total rooms
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-card-label">
            {isAdmin ? 'Confirmed Bookings' : 'My Confirmed Slots'}
          </span>
          <span className="stat-card-value">{metrics.confirmedReservations}</span>
          <span className="stat-card-foot">
            Out of <span className="tabular">{metrics.totalReservations}</span> recorded bookings
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-card-label">Pending Review</span>
          <span className="stat-card-value">{metrics.pendingReservations}</span>
          <span className="stat-card-foot">Awaiting decision</span>
        </div>

        <div className="stat-card">
          <span className="stat-card-label">Open Maintenance</span>
          <span className="stat-card-value">{metrics.openIssues}</span>
          <span className="stat-card-foot">
            <span className="tabular">{metrics.totalIssues}</span> total logged tickets
          </span>
        </div>
      </section>

      {/* 3. Role-Tailored Primary Workspace + Upcoming Schedule & Issues */}
      <div className="two-col-grid">
        {isAdmin ? (
          <section className="glass-panel" aria-label="Pending approval queue">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.85rem',
                gap: '0.75rem',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.1rem' }}>Action Needed: Pending Requests</h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
                  Approve or reject booking requests directly from your queue
                </p>
              </div>
              <Link
                to="/app/admin/reservations"
                style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-blue)' }}
              >
                Open Full Queue →
              </Link>
            </div>

            {queueMsg && (
              <div className="alert-banner alert-info" style={{ marginBottom: '0.75rem' }}>
                {queueMsg}
              </div>
            )}

            {pendingQueue.length === 0 ? (
              <p style={{ fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
                No pending reservation requests awaiting review right now.
              </p>
            ) : (
              <div className="schedule-list">
                {pendingQueue.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="schedule-row"
                    style={{ flexWrap: 'wrap', gap: '0.65rem' }}
                  >
                    <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                        {item.facilityName}
                      </div>
                      <div className="meta-line">
                        <span className="tabular">{item.reservationDate}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular">
                          {item.startTime}–{item.endTime}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{item.requesterName}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        type="button"
                        className="btn btn-coral btn-sm"
                        disabled={queueBusyId === item.id}
                        onClick={() => handleQuickDecision(item.id, 'Confirmed')}
                      >
                        <Check size={14} aria-hidden="true" />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={queueBusyId === item.id}
                        onClick={() => handleQuickDecision(item.id, 'Rejected')}
                      >
                        <X size={14} aria-hidden="true" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="glass-panel" aria-label="Quick CICS room finder">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.85rem',
                gap: '0.75rem',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.1rem' }}>Quick CICS Room Finder</h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
                  Jump straight into a reservable CICS classroom or lab
                </p>
              </div>
              <Link
                to="/app/facilities"
                style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-blue)' }}
              >
                All 38 Spaces →
              </Link>
            </div>

            <div className="form-grid-2" style={{ marginBottom: '0.85rem' }}>
              <div style={{ position: 'relative' }}>
                <Search
                  size={15}
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--ink-muted)',
                  }}
                />
                <input
                  type="search"
                  className="field-input"
                  style={{ paddingLeft: '2.2rem', minHeight: '38px' }}
                  placeholder="Search room or code..."
                  aria-label="Quick room search"
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                />
              </div>

              <select
                className="field-select"
                style={{ minHeight: '38px' }}
                aria-label="Filter quick rooms by floor"
                value={roomFloor}
                onChange={(e) => setRoomFloor(e.target.value)}
              >
                {FLOORS.map((fl) => (
                  <option key={fl} value={fl}>
                    {fl}
                  </option>
                ))}
              </select>
            </div>

            {filteredQuickRooms.length === 0 ? (
              <p style={{ fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
                No reservable Learning rooms match that filter.
              </p>
            ) : (
              <div className="schedule-list">
                {filteredQuickRooms.map((room) => (
                  <div key={room.id} className="schedule-row">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                        {room.name}
                      </div>
                      <div className="meta-line">
                        <span className="tabular">{room.code}</span>
                        <span aria-hidden="true">·</span>
                        <span>{room.floor}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular">
                          {room.openHour}–{room.closeHour}
                        </span>
                      </div>
                    </div>
                    <Link to={`/app/facilities/${room.id}`} className="btn btn-glass btn-sm">
                      Inspect &amp; Book
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Right Column: Today's Class Schedule + Upcoming Reservations + Recent Maintenance Updates */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <section className="glass-panel" aria-label="Today's class schedule">
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: '0.8rem',
                gap: '0.75rem',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.1rem' }}>Today&apos;s Class Schedule</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '0.12rem' }}>
                  {todayWeekday
                    ? `${todayWeekday}${todayManilaDate ? ` · ${todayManilaDate}` : ''} (Asia/Manila)`
                    : 'Automatic Asia/Manila weekday schedule'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                {isAdmin && (
                  <Link
                    to="/app/admin/schedules"
                    style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-blue)' }}
                  >
                    Manage Schedules
                  </Link>
                )}
                <Link
                  to="/app/calendar"
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--accent-blue)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <CalendarDays size={14} aria-hidden="true" />
                  <span>Full Calendar</span>
                </Link>
              </div>
            </div>

            {todayClasses.length === 0 ? (
              <div style={{ padding: '0.5rem 0', color: 'var(--ink-secondary)', fontSize: '0.88rem' }}>
                <p>
                  {isNonInstructionalToday
                    ? `${todayWeekday} is a configured non-instructional / rest day with no recurring in-person CICS classes.`
                    : `No recurring CICS in-person classes are scheduled for ${todayWeekday || 'today'}.`}
                </p>
                <Link to="/app/calendar" className="btn btn-glass btn-sm" style={{ marginTop: '0.65rem' }}>
                  <CalendarDays size={14} aria-hidden="true" />
                  <span>View Full Calendar</span>
                </Link>
              </div>
            ) : (
              <div className="schedule-list">
                {todayClasses.map((cls) => {
                  const isVerified = cls.verificationStatus === VERIFICATION_STATUS.ADMIN_VERIFIED;
                  return (
                    <div key={cls.id} className="class-schedule-row">
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <BookOpen size={14} aria-hidden="true" style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                          <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--ink-primary)' }}>
                            {cls.subjectCode}
                          </span>
                          <span className="tabular" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-blue)' }}>
                            {cls.section}
                          </span>
                        </div>
                        <div className="meta-line" style={{ marginTop: '0.22rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.24rem' }}>
                            <MapPin size={12} aria-hidden="true" />
                            <span>{cls.facilityId ? cls.facilityName : 'Unspecified'}</span>
                          </span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`verification-label ${
                              isVerified
                                ? 'verification-label-verified'
                                : 'verification-label-unverified'
                            }`}
                          >
                            {isVerified ? (
                              <CheckCircle2 size={12} aria-hidden="true" />
                            ) : (
                              <AlertCircle size={12} aria-hidden="true" />
                            )}
                            <span>{formatVerificationLabel(cls.verificationStatus)}</span>
                          </span>
                        </div>
                      </div>
                      <span
                        className="class-time-nowrap"
                        style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--ink-primary)' }}
                      >
                        {formatTimeRange(cls.startTime, cls.endTime)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="glass-panel" aria-label="Upcoming schedule">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.8rem',
              }}
            >
              <h2 style={{ fontSize: '1.1rem' }}>Upcoming Schedule</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <Link
                  to="/app/calendar"
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--accent-blue)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <CalendarDays size={14} aria-hidden="true" />
                  <span>Calendar</span>
                </Link>
                <Link
                  to={isAdmin ? '/app/admin/reservations' : '/app/reservations'}
                  style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-blue)' }}
                >
                  View All
                </Link>
              </div>
            </div>

            {metrics.upcomingSchedule.length === 0 ? (
              <div style={{ padding: '0.75rem 0', color: 'var(--ink-secondary)', fontSize: '0.88rem' }}>
                <p>No upcoming scheduled reservations.</p>
                <Link to="/app/facilities" className="btn btn-glass btn-sm" style={{ marginTop: '0.65rem' }}>
                  Browse Available Spaces
                </Link>
              </div>
            ) : (
              <div className="schedule-list">
                {metrics.upcomingSchedule.map((item) => (
                  <div key={item.id} className="schedule-row">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                        {item.facilityName}
                      </div>
                      <div className="meta-line">
                        <span className="tabular">{item.reservationDate}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular">
                          {item.startTime}–{item.endTime}
                        </span>
                        {item.academicBlock && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="tabular">{item.academicBlock}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span
                      className={`status-text status-${item.status.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="glass-panel" aria-label="Maintenance updates">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.8rem',
              }}
            >
              <h2 style={{ fontSize: '1.1rem' }}>Recent Maintenance Reports</h2>
              <Link
                to={isAdmin ? '/app/admin/maintenance' : '/app/issues'}
                style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-blue)' }}
              >
                Manage Issues →
              </Link>
            </div>

            {recentIssues.length === 0 ? (
              <p style={{ fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
                No maintenance reports have been logged yet.
              </p>
            ) : (
              <div className="schedule-list">
                {recentIssues.map((issue) => (
                  <div key={issue.id} className="schedule-row">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{issue.title}</div>
                      <div className="meta-line">
                        <span>{issue.facilityName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{issue.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{issue.priority}</span>
                      </div>
                    </div>
                    <span
                      className={`status-text status-${issue.status.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {issue.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
