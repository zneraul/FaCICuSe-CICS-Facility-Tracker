import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { AppShell } from '../components/AppShell.jsx';
import { apiRequest } from '../services/api.js';
import {
  ALL_WEEKDAYS,
  CLASS_OPERATING_HOURS,
  NON_INSTRUCTIONAL_WEEKDAYS,
  VERIFICATION_STATUS,
  WEEKDAY_ORDER,
  emitClassSchedulesDirty,
  formatTimeRange,
  formatVerificationLabel,
  validateClassScheduleFormClient,
} from '../utils/classScheduleUtils.js';

const EMPTY_FORM = {
  section: '',
  dayOfWeek: 'Monday',
  startTime: '08:00',
  endTime: '09:00',
  subjectCode: '',
  facilityId: '',
  verificationStatus: VERIFICATION_STATUS.SUPPLIED_UNVERIFIED,
  confirmVerified: false,
};

export function AdminSchedulesPage() {
  const [schedules, setSchedules] = useState([]);
  const [eligibleFacilities, setEligibleFacilities] = useState([]);
  const [sections, setSections] = useState([]);
  const [nonInstructionalDays, setNonInstructionalDays] = useState(NON_INSTRUCTIONAL_WEEKDAYS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  // Filters & sorting
  const [search, setSearch] = useState('');
  const [dayFilter, setDayFilter] = useState('All');
  const [sectionFilter, setSectionFilter] = useState('All');
  const [verificationFilter, setVerificationFilter] = useState('All');
  const [sortBy, setSortBy] = useState('day');
  const [sortDir, setSortDir] = useState('asc');

  // Form state (create or edit)
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');

  // Confirmation modals
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingVerify, setPendingVerify] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const loadAdminSchedules = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest('/admin/class-schedules');
      setSchedules(res.schedules || []);
      setEligibleFacilities(res.eligibleFacilities || []);
      setSections(res.sections || []);
      if (Array.isArray(res.nonInstructionalWeekdays)) {
        setNonInstructionalDays(res.nonInstructionalWeekdays);
      }
    } catch (err) {
      setError(err.message || 'Failed to load recurring class schedules.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminSchedules();
  }, [loadAdminSchedules]);

  function toggleSort(column) {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  }

  const displayedSchedules = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = schedules.filter((item) => {
      if (dayFilter !== 'All' && item.dayOfWeek !== dayFilter) return false;
      if (sectionFilter !== 'All' && item.section !== sectionFilter) return false;
      if (verificationFilter !== 'All' && item.verificationStatus !== verificationFilter) {
        return false;
      }
      if (q) {
        const hay = `${item.section} ${item.subjectCode} ${item.dayOfWeek} ${item.startTime} ${item.endTime} ${item.facilityName || 'Unspecified'} ${item.facilityCode || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === 'day') {
        const dayDiff = (WEEKDAY_ORDER[a.dayOfWeek] || 99) - (WEEKDAY_ORDER[b.dayOfWeek] || 99);
        if (dayDiff !== 0) return dayDiff * dir;
        return String(a.startTime).localeCompare(String(b.startTime)) * dir;
      }
      if (sortBy === 'time') {
        const timeDiff = String(a.startTime).localeCompare(String(b.startTime));
        if (timeDiff !== 0) return timeDiff * dir;
        return ((WEEKDAY_ORDER[a.dayOfWeek] || 99) - (WEEKDAY_ORDER[b.dayOfWeek] || 99)) * dir;
      }
      if (sortBy === 'section') {
        return String(a.section).localeCompare(String(b.section)) * dir;
      }
      if (sortBy === 'subject') {
        return String(a.subjectCode).localeCompare(String(b.subjectCode)) * dir;
      }
      if (sortBy === 'facility') {
        return String(a.facilityName || 'Unspecified').localeCompare(String(b.facilityName || 'Unspecified')) * dir;
      }
      if (sortBy === 'status') {
        return String(a.verificationStatus).localeCompare(String(b.verificationStatus)) * dir;
      }
      return 0;
    });
  }, [schedules, dayFilter, sectionFilter, verificationFilter, search, sortBy, sortDir]);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      section: item.section || '',
      dayOfWeek: item.dayOfWeek || 'Monday',
      startTime: item.startTime || '08:00',
      endTime: item.endTime || '09:00',
      subjectCode: item.subjectCode || '',
      facilityId: item.facilityId ? String(item.facilityId) : '',
      verificationStatus: item.verificationStatus || VERIFICATION_STATUS.SUPPLIED_UNVERIFIED,
      confirmVerified: item.verificationStatus === VERIFICATION_STATUS.ADMIN_VERIFIED,
    });
    setFormError('');
    setFeedback('');
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    setFormError('');
    setFeedback('');

    const clientErr = validateClassScheduleFormClient(form, {
      nonInstructionalWeekdays: nonInstructionalDays,
    });
    if (clientErr) {
      setFormError(clientErr);
      return;
    }

    setFormBusy(true);
    try {
      const payload = {
        section: form.section.trim().toUpperCase(),
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        subjectCode: form.subjectCode.trim().toUpperCase(),
        facilityId: form.facilityId === '' ? null : Number(form.facilityId),
        verificationStatus: form.verificationStatus,
        confirmVerified: Boolean(form.confirmVerified),
      };

      if (editingId) {
        const res = await apiRequest(`/admin/class-schedules/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setFeedback(
          `Updated ${res.schedule.subjectCode} (${res.schedule.section}) on ${res.schedule.dayOfWeek} ${formatTimeRange(res.schedule.startTime, res.schedule.endTime)}.`
        );
      } else {
        const res = await apiRequest('/admin/class-schedules', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback(
          `Saved ${res.schedule.subjectCode} (${res.schedule.section}) on ${res.schedule.dayOfWeek} ${formatTimeRange(res.schedule.startTime, res.schedule.endTime)}.`
        );
      }

      startCreate();
      await loadAdminSchedules();
      emitClassSchedulesDirty();
    } catch (err) {
      setFormError(err.message || 'Unable to save recurring class schedule.');
    } finally {
      setFormBusy(false);
    }
  }

  async function handleConfirmVerify() {
    if (!pendingVerify) return;
    setActionBusy(true);
    setFeedback('');
    setError('');
    try {
      const nextStatus =
        pendingVerify.verificationStatus === VERIFICATION_STATUS.ADMIN_VERIFIED
          ? VERIFICATION_STATUS.SUPPLIED_UNVERIFIED
          : VERIFICATION_STATUS.ADMIN_VERIFIED;

      const res = await apiRequest(`/admin/class-schedules/${pendingVerify.id}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({
          verificationStatus: nextStatus,
          confirmVerified: nextStatus === VERIFICATION_STATUS.ADMIN_VERIFIED,
        }),
      });
      setFeedback(
        `${res.schedule.subjectCode} (${res.schedule.section}) marked as ${formatVerificationLabel(res.schedule.verificationStatus)}.`
      );
      setPendingVerify(null);
      await loadAdminSchedules();
      emitClassSchedulesDirty();
    } catch (err) {
      setError(err.message || 'Unable to update verification status.');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setActionBusy(true);
    setFeedback('');
    setError('');
    try {
      await apiRequest(`/admin/class-schedules/${pendingDelete.id}`, {
        method: 'DELETE',
      });
      if (editingId === pendingDelete.id) {
        startCreate();
      }
      setFeedback(
        `Removed ${pendingDelete.subjectCode} (${pendingDelete.section}, ${pendingDelete.dayOfWeek} ${formatTimeRange(pendingDelete.startTime, pendingDelete.endTime)}).`
      );
      setPendingDelete(null);
      await loadAdminSchedules();
      emitClassSchedulesDirty();
    } catch (err) {
      setError(err.message || 'Unable to remove recurring class schedule.');
    } finally {
      setActionBusy(false);
    }
  }

  const verifiedCount = schedules.filter(
    (s) => s.verificationStatus === VERIFICATION_STATUS.ADMIN_VERIFIED
  ).length;
  const unverifiedCount = schedules.length - verifiedCount;

  const primaryAction = (
    <Link to="/app/calendar" className="btn btn-glass btn-sm">
      <CalendarDays size={15} aria-hidden="true" />
      <span>View Full Calendar</span>
    </Link>
  );

  return (
    <AppShell title="Admin Operations · Class Schedules" primaryAction={primaryAction}>
      {/* Compact Policy & Summary Strip */}
      <section className="glass-panel" aria-label="Recurring class schedule overview">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.85rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
              Recurring Weekly Academic Class Schedules
            </h2>
            <p style={{ fontSize: '0.86rem', color: 'var(--ink-secondary)', marginTop: '0.25rem', maxWidth: '72ch' }}>
              Manage in-person CICS class schedules separately from date-specific reservation requests. Mapped rooms automatically block overlapping facility reservations on matching weekdays.{' '}
              <strong>{nonInstructionalDays.join(', ')}</strong> {nonInstructionalDays.length === 1 ? 'is' : 'are'} configured as non-instructional rest {nonInstructionalDays.length === 1 ? 'day' : 'days'}.
            </p>
          </div>
          <div className="meta-line" style={{ gap: '0.85rem', fontSize: '0.82rem' }}>
            <span className="tabular">
              <strong>{schedules.length}</strong> stored
            </span>
            <span aria-hidden="true">·</span>
            <span className="verification-label verification-label-verified tabular">
              <CheckCircle2 size={13} aria-hidden="true" />
              {verifiedCount} Admin Verified
            </span>
            <span aria-hidden="true">·</span>
            <span className="verification-label verification-label-unverified tabular">
              <AlertCircle size={13} aria-hidden="true" />
              {unverifiedCount} Supplied / Unverified
            </span>
          </div>
        </div>
      </section>

      {error && (
        <div className="alert-banner alert-error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn-glass btn-sm" style={{ marginLeft: 'auto' }} onClick={loadAdminSchedules}>
            Retry
          </button>
        </div>
      )}

      {feedback && (
        <div className="alert-banner alert-success" role="status">
          {feedback}
        </div>
      )}

      {/* Responsive Two-Column Admin Schedules Workspace */}
      <div className="admin-schedules-split">
        {/* LEFT COLUMN: Stored Class Schedules Table */}
        <section className="glass-panel" aria-label="Stored recurring class schedules">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.9rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Stored Class Schedules</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                Changes synchronize immediately with Dashboard, Full Calendar, Public Timetable, and reservation conflict checks.
              </p>
            </div>
            <span className="tabular" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
              Showing {displayedSchedules.length} of {schedules.length}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
              gap: '0.65rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: '0.7rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--ink-muted)',
                }}
              />
              <input
                type="search"
                className="field-input"
                style={{ paddingLeft: '2.1rem', minHeight: '36px', fontSize: '0.85rem' }}
                placeholder="Search subject, section, room..."
                aria-label="Search stored class schedules"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className="field-select"
              style={{ minHeight: '36px', fontSize: '0.85rem' }}
              aria-label="Filter by weekday"
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
            >
              <option value="All">All Days</option>
              {ALL_WEEKDAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>

            <select
              className="field-select"
              style={{ minHeight: '36px', fontSize: '0.85rem' }}
              aria-label="Filter by section"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
            >
              <option value="All">All Sections</option>
              {sections.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>

            <select
              className="field-select"
              style={{ minHeight: '36px', fontSize: '0.85rem' }}
              aria-label="Filter by verification status"
              value={verificationFilter}
              onChange={(e) => setVerificationFilter(e.target.value)}
            >
              <option value="All">All Verification</option>
              <option value={VERIFICATION_STATUS.SUPPLIED_UNVERIFIED}>Supplied / Unverified</option>
              <option value={VERIFICATION_STATUS.ADMIN_VERIFIED}>Admin Verified</option>
            </select>
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--ink-secondary)' }}>
              Loading stored class schedules...
            </div>
          ) : displayedSchedules.length === 0 ? (
            <div className="glass-panel-subtle" style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
                No recurring class schedules match the current filters.
              </p>
              {(search || dayFilter !== 'All' || sectionFilter !== 'All' || verificationFilter !== 'All') && (
                <button
                  type="button"
                  className="btn btn-glass btn-sm"
                  style={{ marginTop: '0.75rem' }}
                  onClick={() => {
                    setSearch('');
                    setDayFilter('All');
                    setSectionFilter('All');
                    setVerificationFilter('All');
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      <button type="button" className="sortable-th-btn" onClick={() => toggleSort('day')}>
                        <span>Day</span>
                        <ArrowUpDown size={12} aria-hidden="true" />
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sortable-th-btn" onClick={() => toggleSort('time')}>
                        <span>Time</span>
                        <ArrowUpDown size={12} aria-hidden="true" />
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sortable-th-btn" onClick={() => toggleSort('section')}>
                        <span>Section</span>
                        <ArrowUpDown size={12} aria-hidden="true" />
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sortable-th-btn" onClick={() => toggleSort('subject')}>
                        <span>Subject</span>
                        <ArrowUpDown size={12} aria-hidden="true" />
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sortable-th-btn" onClick={() => toggleSort('facility')}>
                        <span>Mapped Facility</span>
                        <ArrowUpDown size={12} aria-hidden="true" />
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sortable-th-btn" onClick={() => toggleSort('status')}>
                        <span>Verification</span>
                        <ArrowUpDown size={12} aria-hidden="true" />
                      </button>
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedSchedules.map((item) => {
                    const isVerified =
                      item.verificationStatus === VERIFICATION_STATUS.ADMIN_VERIFIED;
                    const isEditing = editingId === item.id;

                    return (
                      <tr
                        key={item.id}
                        style={isEditing ? { background: 'var(--bg-tint-blue)' } : undefined}
                      >
                        <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{item.dayOfWeek}</td>
                        <td className="class-time-nowrap">
                          {formatTimeRange(item.startTime, item.endTime)}
                        </td>
                        <td className="tabular" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {item.section}
                        </td>
                        <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{item.subjectCode}</td>
                        <td>
                          {item.facilityId ? (
                            <div>
                              <div style={{ fontWeight: 500 }}>{item.facilityName}</div>
                              {item.facilityCode && (
                                <div className="tabular" style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                                  {item.facilityCode}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--ink-muted)' }}>Unspecified</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`verification-label ${
                              isVerified
                                ? 'verification-label-verified'
                                : 'verification-label-unverified'
                            }`}
                          >
                            {isVerified ? (
                              <CheckCircle2 size={13} aria-hidden="true" />
                            ) : (
                              <AlertCircle size={13} aria-hidden="true" />
                            )}
                            <span>{formatVerificationLabel(item.verificationStatus)}</span>
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'nowrap' }}>
                            <button
                              type="button"
                              className="btn btn-glass btn-sm"
                              style={{ padding: '0.28rem 0.55rem', minHeight: '30px', fontSize: '0.76rem' }}
                              title={isVerified ? 'Revert to Supplied / Unverified' : 'Verify Schedule'}
                              onClick={() => setPendingVerify(item)}
                            >
                              <ShieldCheck size={13} aria-hidden="true" />
                              <span>{isVerified ? 'Unverify' : 'Verify'}</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-glass btn-sm"
                              style={{ padding: '0.28rem 0.55rem', minHeight: '30px', fontSize: '0.76rem' }}
                              aria-label={`Edit ${item.subjectCode} ${item.section}`}
                              onClick={() => startEdit(item)}
                            >
                              <Pencil size={13} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger-ghost btn-sm"
                              style={{ padding: '0.28rem 0.55rem', minHeight: '30px', fontSize: '0.76rem' }}
                              aria-label={`Remove ${item.subjectCode} ${item.section}`}
                              onClick={() => setPendingDelete(item)}
                            >
                              <Trash2 size={13} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* RIGHT COLUMN: Add / Edit In-Person Schedule Form */}
        <aside className="glass-panel admin-schedules-form-panel" aria-label="Add or edit recurring class schedule">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                {editingId ? 'Edit In-Person Schedule' : 'Add In-Person Schedule'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                Operating hours: {CLASS_OPERATING_HOURS.openHour}–{CLASS_OPERATING_HOURS.closeHour}. In-person classes only.
              </p>
            </div>
            {editingId && (
              <button
                type="button"
                className="btn btn-glass btn-sm"
                onClick={startCreate}
              >
                <X size={14} aria-hidden="true" />
                <span>Cancel</span>
              </button>
            )}
          </div>

          {formError && (
            <div className="alert-banner alert-error" role="alert" style={{ marginBottom: '0.85rem' }}>
              {formError}
            </div>
          )}

          <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }} noValidate>
            <div className="form-grid-2">
              <div className="field-group">
                <label htmlFor="cs-section" className="field-label">
                  Section / Program
                </label>
                <input
                  id="cs-section"
                  type="text"
                  className="field-input"
                  required
                  maxLength={40}
                  placeholder="e.g. IT-3106"
                  value={form.section}
                  onChange={(e) => setForm({ ...form, section: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="field-group">
                <label htmlFor="cs-subject" className="field-label">
                  Subject Code
                </label>
                <input
                  id="cs-subject"
                  type="text"
                  className="field-input"
                  required
                  maxLength={40}
                  placeholder="e.g. IT 314"
                  value={form.subjectCode}
                  onChange={(e) => setForm({ ...form, subjectCode: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="cs-day" className="field-label">
                Day of Week
              </label>
              <select
                id="cs-day"
                className="field-select"
                required
                value={form.dayOfWeek}
                onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}
              >
                {ALL_WEEKDAYS.map((day) => {
                  const isRestDay = nonInstructionalDays.includes(day);
                  return (
                    <option key={day} value={day} disabled={isRestDay}>
                      {isRestDay ? `${day} (Non-instructional / Rest Day)` : day}
                    </option>
                  );
                })}
              </select>
              <span style={{ fontSize: '0.76rem', color: 'var(--ink-muted)' }}>
                {nonInstructionalDays.join(', ')} is configured as a non-instructional rest day and cannot be scheduled.
              </span>
            </div>

            <div className="form-grid-2">
              <div className="field-group">
                <label htmlFor="cs-start" className="field-label">
                  Start Time (24h)
                </label>
                <input
                  id="cs-start"
                  type="time"
                  min={CLASS_OPERATING_HOURS.openHour}
                  max={CLASS_OPERATING_HOURS.closeHour}
                  className="field-input"
                  required
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                />
              </div>

              <div className="field-group">
                <label htmlFor="cs-end" className="field-label">
                  End Time (24h)
                </label>
                <input
                  id="cs-end"
                  type="time"
                  min={CLASS_OPERATING_HOURS.openHour}
                  max={CLASS_OPERATING_HOURS.closeHour}
                  className="field-input"
                  required
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                />
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="cs-facility" className="field-label">
                Mapped CICS Learning Facility
              </label>
              <select
                id="cs-facility"
                className="field-select"
                value={form.facilityId}
                onChange={(e) => setForm({ ...form, facilityId: e.target.value })}
              >
                <option value="">Unspecified (does not block a room)</option>
                {eligibleFacilities.map((fac) => (
                  <option key={fac.id} value={String(fac.id)}>
                    {fac.name} ({fac.code} · {fac.floor})
                  </option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label htmlFor="cs-verification" className="field-label">
                Verification Status
              </label>
              <select
                id="cs-verification"
                className="field-select"
                value={form.verificationStatus}
                onChange={(e) => {
                  const next = e.target.value;
                  setForm({
                    ...form,
                    verificationStatus: next,
                    confirmVerified:
                      next === VERIFICATION_STATUS.ADMIN_VERIFIED ? form.confirmVerified : false,
                  });
                }}
              >
                <option value={VERIFICATION_STATUS.SUPPLIED_UNVERIFIED}>
                  Supplied / Unverified
                </option>
                <option value={VERIFICATION_STATUS.ADMIN_VERIFIED}>
                  Admin Verified
                </option>
              </select>
            </div>

            {form.verificationStatus === VERIFICATION_STATUS.ADMIN_VERIFIED && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  fontSize: '0.82rem',
                  color: 'var(--ink-primary)',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '8px',
                  background: 'var(--bg-tint-blue)',
                  border: '1px solid var(--border-blue)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={form.confirmVerified}
                  onChange={(e) => setForm({ ...form, confirmVerified: e.target.checked })}
                  style={{ marginTop: '2px' }}
                />
                <span>
                  I confirm this recurring class schedule has been verified against official CICS academic scheduling records.
                </span>
              </label>
            )}

            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
              {editingId && (
                <button type="button" className="btn btn-glass" onClick={startCreate} disabled={formBusy}>
                  Reset
                </button>
              )}
              <button type="submit" className="btn btn-coral" disabled={formBusy}>
                <Plus size={15} aria-hidden="true" />
                <span>
                  {formBusy
                    ? 'Saving...'
                    : editingId
                      ? 'Save Schedule Changes'
                      : 'Add Class Schedule'}
                </span>
              </button>
            </div>
          </form>
        </aside>
      </div>

      {/* Verify / Unverify Confirmation Modal */}
      {pendingVerify && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm schedule verification status change"
        >
          <div className="modal-panel">
            <h2 style={{ fontSize: '1.15rem', marginBottom: '0.45rem' }}>
              {pendingVerify.verificationStatus === VERIFICATION_STATUS.ADMIN_VERIFIED
                ? 'Revert Verification Status?'
                : 'Confirm Admin Verification'}
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--ink-secondary)', marginBottom: '1rem' }}>
              {pendingVerify.verificationStatus === VERIFICATION_STATUS.ADMIN_VERIFIED ? (
                <>
                  Revert <strong>{pendingVerify.subjectCode}</strong> ({pendingVerify.section},{' '}
                  {pendingVerify.dayOfWeek} {formatTimeRange(pendingVerify.startTime, pendingVerify.endTime)}) back to{' '}
                  <strong>Supplied / Unverified</strong>?
                </>
              ) : (
                <>
                  Mark <strong>{pendingVerify.subjectCode}</strong> ({pendingVerify.section},{' '}
                  {pendingVerify.dayOfWeek} {formatTimeRange(pendingVerify.startTime, pendingVerify.endTime)} ·{' '}
                  {pendingVerify.facilityName || 'Unspecified'}) as <strong>Admin Verified</strong>? This action is recorded in the administrative audit log.
                </>
              )}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn btn-glass btn-sm"
                disabled={actionBusy}
                onClick={() => setPendingVerify(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-coral btn-sm"
                disabled={actionBusy}
                onClick={handleConfirmVerify}
              >
                {actionBusy
                  ? 'Updating...'
                  : pendingVerify.verificationStatus === VERIFICATION_STATUS.ADMIN_VERIFIED
                    ? 'Mark Supplied / Unverified'
                    : 'Confirm Admin Verified'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {pendingDelete && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm recurring class schedule removal"
        >
          <div className="modal-panel">
            <h2 style={{ fontSize: '1.15rem', marginBottom: '0.45rem' }}>
              Remove Recurring Class Schedule?
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--ink-secondary)', marginBottom: '1rem' }}>
              Remove <strong>{pendingDelete.subjectCode}</strong> ({pendingDelete.section}) on{' '}
              <strong>{pendingDelete.dayOfWeek}</strong>{' '}
              <span className="class-time-nowrap">
                {formatTimeRange(pendingDelete.startTime, pendingDelete.endTime)}
              </span>{' '}
              ({pendingDelete.facilityName || 'Unspecified'})? This removes the recurring block from the Dashboard, Full Calendar, Public Timetable, and future reservation conflict checks.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn btn-glass btn-sm"
                disabled={actionBusy}
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger-ghost btn-sm"
                disabled={actionBusy}
                onClick={handleConfirmDelete}
              >
                {actionBusy ? 'Removing...' : 'Remove Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
