import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Calendar as CalendarIcon,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  MapPin,
  Search,
  Users,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { AppShell } from '../components/AppShell.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/api.js';
import {
  addDays,
  addMonths,
  formatHourLabel,
  formatPeriodTitle,
  formatShortDayHeader,
  getMonthGridDays,
  getPeriodRange,
  getWeekDays,
  timeToMinutes,
  toIsoDate,
} from '../utils/calendarUtils.js';
import {
  ALL_WEEKDAYS,
  CLASS_SCHEDULES_DIRTY_EVENT,
  VERIFICATION_STATUS,
  formatTimeRange,
  formatVerificationLabel,
  getWeekdayFromIsoDate,
} from '../utils/classScheduleUtils.js';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CATEGORIES = ['All', 'Learning', 'Administrative', 'Support'];
const FLOORS = ['All Floors', 'First Floor', 'Second Floor', 'Third Floor', 'Fourth Floor', 'Fifth Floor'];
const STATUS_OPTIONS = ['All', 'Confirmed', 'Pending', 'Completed', 'Rejected', 'Cancelled'];
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00..22:00

function getClassPillClass(verificationStatus) {
  return verificationStatus === VERIFICATION_STATUS.ADMIN_VERIFIED
    ? 'calendar-event-class calendar-event-class-verified'
    : 'calendar-event-class calendar-event-class-unverified';
}

function getStatusPillClass(status) {
  return `calendar-event-${String(status || 'pending').toLowerCase().replace(/\s+/g, '-')}`;
}

export function CalendarPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  const [view, setView] = useState('month');
  const [anchorDate, setAnchorDate] = useState(todayIso);
  const [selectedDate, setSelectedDate] = useState(todayIso);

  const [events, setEvents] = useState([]);
  const [classSchedules, setClassSchedules] = useState([]);
  const [classSections, setClassSections] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  // Filters
  const [facilityFilter, setFacilityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [floorFilter, setFloorFilter] = useState('All Floors');
  const [statusFilter, setStatusFilter] = useState('All');
  const [weekdayFilter, setWeekdayFilter] = useState('All');
  const [sectionFilter, setSectionFilter] = useState('All');
  const [showClasses, setShowClasses] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [mineOnly, setMineOnly] = useState(false);

  // Selected event & read-only class schedule modal state
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedClassSchedule, setSelectedClassSchedule] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({
    facilityId: '',
    reservationDate: '',
    startTime: '',
    endTime: '',
  });
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState('');

  // Create reservation / admin schedule modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    facilityId: '',
    reservationDate: addDays(todayIso, 1),
    startTime: '10:00',
    endTime: '11:30',
    attendeesCount: '30',
    academicBlock: user?.academicBlock || '',
    purpose: '',
    status: isAdmin ? 'Confirmed' : 'Pending',
  });
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState('');

  const periodRange = useMemo(() => getPeriodRange(view, anchorDate), [view, anchorDate]);

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('startDate', periodRange.startDate);
      params.set('endDate', periodRange.endDate);
      if (facilityFilter !== 'All') params.set('facilityId', facilityFilter);
      if (categoryFilter !== 'All') params.set('category', categoryFilter);
      if (floorFilter !== 'All Floors') params.set('floor', floorFilter);
      if (statusFilter !== 'All') params.set('status', statusFilter);
      if (weekdayFilter !== 'All') params.set('dayOfWeek', weekdayFilter);
      if (sectionFilter !== 'All') params.set('section', sectionFilter);
      if (searchFilter.trim()) params.set('search', searchFilter.trim());
      if (mineOnly) params.set('mineOnly', 'true');

      const res = await apiRequest(`/calendar?${params.toString()}`);
      setEvents(res.events || []);
      setClassSchedules(res.classSchedules || []);
      setClassSections(res.classSections || []);
      const facList = res.facilities || [];
      setFacilities(facList);
      setConflicts(res.conflicts || []);
      const defaultBookable =
        facList.find((f) => f.isReservable !== false && f.status === 'Available') || facList[0];
      if (defaultBookable) {
        setCreateForm((prev) => ({
          ...prev,
          facilityId: prev.facilityId || String(defaultBookable.id),
        }));
      }
    } catch (err) {
      setError(err.message || 'Unable to load facility calendar.');
    } finally {
      setLoading(false);
    }
  }, [
    periodRange.startDate,
    periodRange.endDate,
    facilityFilter,
    categoryFilter,
    floorFilter,
    statusFilter,
    weekdayFilter,
    sectionFilter,
    searchFilter,
    mineOnly,
  ]);

  useEffect(() => {
    loadCalendar();
    const handleDirty = () => loadCalendar();
    window.addEventListener(CLASS_SCHEDULES_DIRTY_EVENT, handleDirty);
    return () => window.removeEventListener(CLASS_SCHEDULES_DIRTY_EVENT, handleDirty);
  }, [loadCalendar]);

  function handleNavigate(direction) {
    if (direction === 'today') {
      setAnchorDate(todayIso);
      setSelectedDate(todayIso);
      return;
    }
    const step = direction === 'next' ? 1 : -1;
    if (view === 'month') {
      const nextAnchor = addMonths(anchorDate, step);
      setAnchorDate(nextAnchor);
      setSelectedDate(nextAnchor);
    } else if (view === 'week') {
      const nextAnchor = addDays(anchorDate, step * 7);
      setAnchorDate(nextAnchor);
      setSelectedDate(nextAnchor);
    } else {
      const nextAnchor = addDays(anchorDate, step);
      setAnchorDate(nextAnchor);
      setSelectedDate(nextAnchor);
    }
  }

  function openCreateModal(prefillDate = selectedDate, prefillHour = '10:00') {
    const startH = Number(prefillHour.split(':')[0] || 10);
    const endH = Math.min(22, startH + 1);
    const defaultFacId =
      facilityFilter !== 'All'
        ? facilityFilter
        : facilities.find((f) => f.isReservable !== false && f.status === 'Available')?.id ||
          facilities.find((f) => f.isReservable !== false)?.id ||
          facilities[0]?.id ||
          '';

    setCreateError('');
    setCreateForm({
      facilityId: String(defaultFacId),
      reservationDate: prefillDate || addDays(todayIso, 1),
      startTime: `${String(startH).padStart(2, '0')}:00`,
      endTime: `${String(endH).padStart(2, '0')}:00`,
      attendeesCount: '30',
      academicBlock: user?.academicBlock || '',
      purpose: '',
      status: isAdmin ? 'Confirmed' : 'Pending',
    });
    setCreateOpen(true);
  }

  function openEventDetail(event) {
    setSelectedEvent(event);
    setReviewNote(event.reviewNote || '');
    setRescheduleMode(false);
    setRescheduleForm({
      facilityId: String(event.facilityId),
      reservationDate: event.reservationDate,
      startTime: event.startTime,
      endTime: event.endTime,
    });
    setDetailError('');
  }

  async function handleCreateSubmit(e) {
    e.preventDefault();
    setCreateBusy(true);
    setCreateError('');
    setFeedback('');
    try {
      const endpoint = isAdmin ? '/admin/schedules' : '/reservations';
      const res = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          facilityId: Number(createForm.facilityId),
          reservationDate: createForm.reservationDate,
          startTime: createForm.startTime,
          endTime: createForm.endTime,
          attendeesCount: Number(createForm.attendeesCount),
          academicBlock: createForm.academicBlock?.trim() || null,
          purpose: createForm.purpose,
          status: createForm.status,
        }),
      });
      setCreateOpen(false);
      setAnchorDate(createForm.reservationDate);
      setSelectedDate(createForm.reservationDate);
      setFeedback(
        isAdmin
          ? `Schedule block #${res.reservation.id} (${res.reservation.status}) saved to calendar.`
          : `Reservation request #${res.reservation.id} submitted with status Pending.`
      );
      await loadCalendar();
    } catch (err) {
      setCreateError(err.message || 'Could not save calendar booking.');
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleCancelSelected() {
    if (!selectedEvent) return;
    setDetailBusy(true);
    setDetailError('');
    setFeedback('');
    try {
      await apiRequest(`/reservations/${selectedEvent.id}/cancel`, { method: 'PATCH' });
      setSelectedEvent(null);
      setFeedback(`Reservation #${selectedEvent.id} cancelled.`);
      await loadCalendar();
    } catch (err) {
      setDetailError(err.message || 'Unable to cancel reservation.');
    } finally {
      setDetailBusy(false);
    }
  }

  async function handleAdminReview(nextStatus) {
    if (!selectedEvent) return;
    setDetailBusy(true);
    setDetailError('');
    setFeedback('');
    try {
      await apiRequest(`/admin/reservations/${selectedEvent.id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus, reviewNote }),
      });
      setSelectedEvent(null);
      setFeedback(`Reservation #${selectedEvent.id} marked ${nextStatus}.`);
      await loadCalendar();
    } catch (err) {
      setDetailError(err.message || 'Unable to update reservation status.');
    } finally {
      setDetailBusy(false);
    }
  }

  async function handleRescheduleSubmit(e) {
    e.preventDefault();
    if (!selectedEvent) return;
    setDetailBusy(true);
    setDetailError('');
    setFeedback('');
    try {
      await apiRequest(`/admin/reservations/${selectedEvent.id}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify({
          facilityId: Number(rescheduleForm.facilityId),
          reservationDate: rescheduleForm.reservationDate,
          startTime: rescheduleForm.startTime,
          endTime: rescheduleForm.endTime,
          reviewNote,
        }),
      });
      setSelectedEvent(null);
      setFeedback(`Reservation #${selectedEvent.id} rescheduled and conflict-checked.`);
      await loadCalendar();
    } catch (err) {
      setDetailError(err.message || 'Unable to reschedule reservation.');
    } finally {
      setDetailBusy(false);
    }
  }

  const eventsByDate = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      if (!map.has(ev.reservationDate)) {
        map.set(ev.reservationDate, []);
      }
      map.get(ev.reservationDate).push(ev);
    }
    return map;
  }, [events]);

  const classSchedulesByWeekday = useMemo(() => {
    const map = new Map();
    if (!showClasses) return map;
    for (const cs of classSchedules) {
      if (!map.has(cs.dayOfWeek)) {
        map.set(cs.dayOfWeek, []);
      }
      map.get(cs.dayOfWeek).push(cs);
    }
    return map;
  }, [classSchedules, showClasses]);

  const getClassesForDate = useCallback(
    (isoDate) => {
      if (!showClasses) return [];
      const wd = getWeekdayFromIsoDate(isoDate);
      return classSchedulesByWeekday.get(wd) || [];
    },
    [classSchedulesByWeekday, showClasses]
  );

  const monthDays = useMemo(() => getMonthGridDays(anchorDate), [anchorDate]);
  const weekDays = useMemo(() => getWeekDays(anchorDate), [anchorDate]);
  const selectedDayEvents = eventsByDate.get(selectedDate) || [];
  const selectedDayClasses = getClassesForDate(selectedDate);
  const anchorDayEvents = eventsByDate.get(anchorDate) || [];
  const anchorDayClasses = getClassesForDate(anchorDate);
  const periodTitle = formatPeriodTitle(view, anchorDate);

  const primaryAction = (
    <button
      type="button"
      className="btn btn-coral btn-sm"
      onClick={() => openCreateModal(selectedDate)}
    >
      <CalendarPlus size={16} aria-hidden="true" />
      <span>{isAdmin ? 'Add Schedule Block' : 'Request Booking'}</span>
    </button>
  );

  return (
    <AppShell title="Facility Calendar & Scheduling" primaryAction={primaryAction}>
      {/* Calendar Period & View Toolbar */}
      <section className="glass-panel" aria-label="Calendar controls">
        <div className="calendar-toolbar">
          <div className="calendar-nav-group">
            <button
              type="button"
              className="icon-btn"
              aria-label="Previous period"
              onClick={() => handleNavigate('prev')}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="btn btn-glass btn-sm"
              onClick={() => handleNavigate('today')}
            >
              Today
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Next period"
              onClick={() => handleNavigate('next')}
            >
              <ChevronRight size={18} />
            </button>
            <h2 className="calendar-period-title">{periodTitle}</h2>
          </div>

          <div className="v10-tabs" role="tablist" aria-label="Calendar view mode">
            {[
              { id: 'month', label: 'Month' },
              { id: 'week', label: 'Week' },
              { id: 'day', label: 'Day' },
            ].map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={view === v.id}
                className={`v10-tab-btn ${view === v.id ? 'active' : ''}`}
                onClick={() => {
                  setView(v.id);
                  if (v.id === 'day') {
                    setAnchorDate(selectedDate);
                  }
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters Row */}
        <div
          className="calendar-filters-grid"
          style={{
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--glass-border-subtle)',
          }}
        >
          <div className="field-group">
            <label htmlFor="cal-search" className="field-label">
              Search schedule
            </label>
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
                id="cal-search"
                type="search"
                className="field-input"
                style={{ paddingLeft: '2.2rem' }}
                placeholder="Facility, code, building, purpose..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="field-group">
            <label htmlFor="cal-facility" className="field-label">
              Facility
            </label>
            <select
              id="cal-facility"
              className="field-select"
              value={facilityFilter}
              onChange={(e) => setFacilityFilter(e.target.value)}
            >
              <option value="All">All Facilities</option>
              {facilities.map((f) => (
                <option key={f.id} value={String(f.id)}>
                  {f.code} · {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label htmlFor="cal-category" className="field-label">
              Category
            </label>
            <select
              id="cal-category"
              className="field-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c === 'All' ? 'All Categories' : c}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label htmlFor="cal-floor" className="field-label">
              Floor
            </label>
            <select
              id="cal-floor"
              className="field-select"
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
            >
              {FLOORS.map((fl) => (
                <option key={fl} value={fl}>
                  {fl}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label htmlFor="cal-status" className="field-label">
              Status
            </label>
            <select
              id="cal-status"
              className="field-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === 'All' ? 'All Statuses' : s}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label htmlFor="cal-weekday" className="field-label">
              Weekday
            </label>
            <select
              id="cal-weekday"
              className="field-select"
              value={weekdayFilter}
              onChange={(e) => setWeekdayFilter(e.target.value)}
            >
              <option value="All">All Days</option>
              {ALL_WEEKDAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label htmlFor="cal-section" className="field-label">
              Section / Program
            </label>
            <select
              id="cal-section"
              className="field-select"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
            >
              <option value="All">All Sections</option>
              {classSections.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>

          <div className="calendar-filter-toggles">
            <button
              type="button"
              className={`btn btn-sm ${showClasses ? 'btn-coral' : 'btn-glass'}`}
              aria-pressed={showClasses}
              onClick={() => setShowClasses((prev) => !prev)}
            >
              <BookOpen size={14} aria-hidden="true" />
              <span>Recurring Classes</span>
            </button>

            <button
              type="button"
              className={`btn btn-sm ${mineOnly ? 'btn-coral' : 'btn-glass'}`}
              aria-pressed={mineOnly}
              onClick={() => setMineOnly((prev) => !prev)}
            >
              <Filter size={14} aria-hidden="true" />
              <span>My Bookings</span>
            </button>
          </div>
        </div>

        {/* Status Legend with Explicit Text Labels */}
        <div
          className="meta-line"
          style={{ marginTop: '0.85rem', gap: '0.85rem', fontSize: '0.78rem' }}
          aria-label="Calendar entry key"
        >
          <span className="calendar-legend-class">
            <span className="calendar-legend-class-swatch" aria-hidden="true" />
            <span>Recurring Class</span>
          </span>
          <span className="status-text status-confirmed">Confirmed Booking</span>
          <span className="status-text status-pending">Pending</span>
          <span className="status-text status-open">Completed</span>
          <span className="status-text status-rejected">Rejected / Cancelled</span>
          <span style={{ marginLeft: 'auto', color: 'var(--ink-muted)' }} className="tabular">
            {events.length} {events.length === 1 ? 'booking' : 'bookings'}
            {showClasses ? ` · ${classSchedules.length} weekly ${classSchedules.length === 1 ? 'class' : 'classes'}` : ''}
          </span>
        </div>
      </section>

      {/* Admin Schedule Conflict Alert Banner */}
      {isAdmin && conflicts.length > 0 && (
        <aside className="alert-banner alert-error" role="status" aria-label="Schedule conflicts">
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
            <strong>
              {conflicts.length} scheduling conflict{conflicts.length > 1 ? 's' : ''} detected for admin review
            </strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {conflicts.slice(0, 4).map((c) => (
                <button
                  key={c.reservationId}
                  type="button"
                  className="btn btn-glass btn-sm"
                  onClick={() => {
                    setAnchorDate(c.reservationDate);
                    setSelectedDate(c.reservationDate);
                    setView('day');
                  }}
                >
                  #{c.reservationId} {c.facilityCode} ({c.reservationDate}): {c.reasons[0]}
                </button>
              ))}
            </div>
          </div>
        </aside>
      )}

      {error && (
        <div className="alert-banner alert-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-glass btn-sm"
            style={{ marginLeft: 'auto' }}
            onClick={loadCalendar}
          >
            Retry
          </button>
        </div>
      )}

      {feedback && (
        <div className="alert-banner alert-success" role="status">
          {feedback}
        </div>
      )}

      {/* Main Calendar Canvas */}
      <motion.section
        key={`${view}-${anchorDate}`}
        initial={{ opacity: 0.72, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="glass-panel"
        aria-label={`${view} calendar view`}
      >
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--ink-secondary)' }}>
            Loading facility schedules and reservations...
          </div>
        ) : (
          <>
            {/* MONTH VIEW */}
            {view === 'month' && (
              <div className="calendar-month-wrapper">
                <div className="calendar-weekday-row" aria-hidden="true">
                  {WEEKDAY_LABELS.map((wd) => (
                    <div key={wd} className="calendar-weekday-cell">
                      {wd}
                    </div>
                  ))}
                </div>

                <div className="calendar-month-grid">
                  {monthDays.map((cell) => {
                    const dayEvents = eventsByDate.get(cell.iso) || [];
                    const dayClasses = getClassesForDate(cell.iso);
                    const combinedItems = [
                      ...dayClasses.map((cs) => ({ kind: 'class', sortKey: cs.startTime, data: cs })),
                      ...dayEvents.map((ev) => ({ kind: 'reservation', sortKey: ev.startTime, data: ev })),
                    ].sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));

                    const isToday = cell.iso === todayIso;
                    const isSelected = cell.iso === selectedDate;

                    return (
                      <div
                        key={cell.iso}
                        className={`calendar-day-cell ${!cell.inCurrentMonth ? 'outside-month' : ''} ${
                          isToday ? 'is-today' : ''
                        } ${isSelected ? 'is-selected' : ''}`}
                      >
                        <div className="calendar-day-header">
                          <button
                            type="button"
                            className="calendar-day-num-btn"
                            aria-label={`Select ${cell.iso}, ${dayEvents.length} reservations and ${dayClasses.length} classes`}
                            onClick={() => setSelectedDate(cell.iso)}
                          >
                            {cell.dayNumber}
                          </button>
                          <button
                            type="button"
                            className="calendar-day-add-btn"
                            aria-label={`Add booking on ${cell.iso}`}
                            onClick={() => {
                              setSelectedDate(cell.iso);
                              openCreateModal(cell.iso);
                            }}
                          >
                            +
                          </button>
                        </div>

                        {combinedItems.slice(0, 3).map((entry) =>
                          entry.kind === 'class' ? (
                            <button
                              key={`cls-${entry.data.id}`}
                              type="button"
                              className={`calendar-event-pill ${getClassPillClass(entry.data.verificationStatus)}`}
                              onClick={() => setSelectedClassSchedule({ ...entry.data, occurrenceDate: cell.iso })}
                            >
                              <div className="calendar-event-top">
                                <span className="tabular">{entry.data.startTime}</span>
                                <span>Class</span>
                              </div>
                              <div className="calendar-event-title">
                                {entry.data.subjectCode} · {entry.data.section}
                              </div>
                            </button>
                          ) : (
                            <button
                              key={`res-${entry.data.id}`}
                              type="button"
                              className={`calendar-event-pill ${getStatusPillClass(entry.data.status)} ${
                                entry.data.conflict ? 'calendar-event-conflict' : ''
                              }`}
                              onClick={() => openEventDetail(entry.data)}
                            >
                              <div className="calendar-event-top">
                                <span className="tabular">{entry.data.startTime}</span>
                                <span>{entry.data.status}</span>
                              </div>
                              <div className="calendar-event-title">
                                {entry.data.facilityCode} · {entry.data.purpose}
                              </div>
                            </button>
                          )
                        )}

                        {combinedItems.length > 3 && (
                          <button
                            type="button"
                            className="calendar-more-btn"
                            onClick={() => {
                              setSelectedDate(cell.iso);
                              setAnchorDate(cell.iso);
                              setView('day');
                            }}
                          >
                            +{combinedItems.length - 3} more
                          </button>
                        )}

                        {combinedItems.length > 0 && (
                          <div className="calendar-mobile-dots" aria-hidden="true">
                            {combinedItems.slice(0, 4).map((entry) => (
                              <span
                                key={`${entry.kind}-${entry.data.id}`}
                                style={{
                                  width: '7px',
                                  height: '7px',
                                  borderRadius: '999px',
                                  background:
                                    entry.kind === 'class'
                                      ? '#2563eb'
                                      : entry.data.status === 'Confirmed'
                                        ? '#16a34a'
                                        : entry.data.status === 'Pending'
                                          ? '#d97706'
                                          : '#e11d48',
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Mobile Agenda List for Selected Month Day */}
                <div className="calendar-mobile-agenda">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                    <strong className="tabular" style={{ fontSize: '0.95rem' }}>
                      Agenda · {selectedDate}
                    </strong>
                    <button
                      type="button"
                      className="btn btn-glass btn-sm"
                      onClick={() => {
                        setAnchorDate(selectedDate);
                        setView('day');
                      }}
                    >
                      Open Day View
                    </button>
                  </div>
                  {selectedDayEvents.length === 0 && selectedDayClasses.length === 0 ? (
                    <p style={{ fontSize: '0.86rem', color: 'var(--ink-secondary)' }}>
                      No reservations or recurring classes on {selectedDate}.
                    </p>
                  ) : (
                    <div className="schedule-list" style={{ gap: '0.45rem' }}>
                      {selectedDayClasses.map((cs) => (
                        <button
                          key={`m-cls-${cs.id}`}
                          type="button"
                          className={`calendar-event-pill ${getClassPillClass(cs.verificationStatus)}`}
                          style={{ padding: '0.6rem 0.75rem' }}
                          onClick={() => setSelectedClassSchedule({ ...cs, occurrenceDate: selectedDate })}
                        >
                          <div className="calendar-event-top">
                            <span className="class-time-nowrap">
                              {formatTimeRange(cs.startTime, cs.endTime)} · {cs.subjectCode} ({cs.section})
                            </span>
                            <span>Class</span>
                          </div>
                          <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                            {cs.facilityId ? cs.facilityName : 'Unspecified'} · {formatVerificationLabel(cs.verificationStatus)}
                          </div>
                        </button>
                      ))}
                      {selectedDayEvents.map((ev) => (
                        <button
                          key={`m-res-${ev.id}`}
                          type="button"
                          className={`calendar-event-pill ${getStatusPillClass(ev.status)}`}
                          style={{ padding: '0.6rem 0.75rem' }}
                          onClick={() => openEventDetail(ev)}
                        >
                          <div className="calendar-event-top">
                            <span className="class-time-nowrap">
                              {ev.startTime}–{ev.endTime} · {ev.facilityCode}
                            </span>
                            <span>{ev.status}</span>
                          </div>
                          <div style={{ fontSize: '0.84rem', marginTop: '0.2rem' }}>{ev.purpose}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* WEEK VIEW */}
            {view === 'week' && (
              <div className="calendar-week-scroll">
                <div className="calendar-week-grid">
                  <div className="calendar-week-corner">Hour</div>
                  {weekDays.map((dayIso) => {
                    const hdr = formatShortDayHeader(dayIso);
                    const isToday = dayIso === todayIso;
                    return (
                      <button
                        key={dayIso}
                        type="button"
                        className={`calendar-week-col-header ${isToday ? 'is-today' : ''}`}
                        style={{ borderTop: 'none', borderLeft: 'none', color: 'var(--ink-primary)' }}
                        onClick={() => {
                          setSelectedDate(dayIso);
                          setAnchorDate(dayIso);
                          setView('day');
                        }}
                      >
                        <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{hdr.weekday}</div>
                        <div className="tabular" style={{ fontSize: '1rem', fontWeight: 700 }}>
                          {hdr.day}
                        </div>
                      </button>
                    );
                  })}

                  {/* Time Axis Column */}
                  <div>
                    {HOURS.map((hr) => (
                      <div key={hr} className="calendar-hour-label">
                        {formatHourLabel(hr)}
                      </div>
                    ))}
                  </div>

                  {/* 7 Day Columns */}
                  {weekDays.map((dayIso) => {
                    const dayEvents = eventsByDate.get(dayIso) || [];
                    const dayClasses = getClassesForDate(dayIso);
                    return (
                      <div key={dayIso} className="calendar-week-day-track">
                        {HOURS.map((hr) => (
                          <div
                            key={hr}
                            className="calendar-week-hour-slot"
                            title={`Schedule ${dayIso} at ${formatHourLabel(hr)}`}
                            onClick={() => openCreateModal(dayIso, formatHourLabel(hr))}
                          />
                        ))}

                        {dayClasses.map((cs) => {
                          const startMin = Math.max(6 * 60, timeToMinutes(cs.startTime));
                          const endMin = Math.min(23 * 60, timeToMinutes(cs.endTime));
                          const topPx = ((startMin - 6 * 60) / 60) * 52;
                          const heightPx = Math.max(30, ((endMin - startMin) / 60) * 52);

                          return (
                            <button
                              key={`wk-cls-${cs.id}`}
                              type="button"
                              className={`calendar-week-event-block ${getClassPillClass(cs.verificationStatus)}`}
                              style={{ top: `${topPx + 2}px`, height: `${heightPx - 4}px` }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedClassSchedule({ ...cs, occurrenceDate: dayIso });
                              }}
                            >
                              <div className="calendar-event-top">
                                <span className="tabular">{cs.subjectCode}</span>
                                <span>Class</span>
                              </div>
                              <div className="calendar-event-title">
                                {cs.section} · {cs.facilityId ? cs.facilityName : 'Unspecified'}
                              </div>
                            </button>
                          );
                        })}

                        {dayEvents.map((ev) => {
                          const startMin = Math.max(6 * 60, timeToMinutes(ev.startTime));
                          const endMin = Math.min(23 * 60, timeToMinutes(ev.endTime));
                          const topPx = ((startMin - 6 * 60) / 60) * 52;
                          const heightPx = Math.max(28, ((endMin - startMin) / 60) * 52);

                          return (
                            <button
                              key={`wk-res-${ev.id}`}
                              type="button"
                              className={`calendar-week-event-block ${getStatusPillClass(ev.status)} ${
                                ev.conflict ? 'calendar-event-conflict' : ''
                              }`}
                              style={{ top: `${topPx + 2}px`, height: `${heightPx - 4}px`, zIndex: 3 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                openEventDetail(ev);
                              }}
                            >
                              <div className="calendar-event-top">
                                <span className="tabular">{ev.facilityCode}</span>
                                <span>{ev.status}</span>
                              </div>
                              <div className="calendar-event-title">
                                {ev.startTime}–{ev.endTime} · {ev.purpose}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DAY VIEW */}
            {view === 'day' && (
              <div className="calendar-day-split">
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.85rem',
                    }}
                  >
                    <h3 style={{ fontSize: '1.08rem' }}>
                      Daily Agenda · <time className="tabular">{anchorDate}</time>
                    </h3>
                    <button
                      type="button"
                      className="btn btn-coral btn-sm"
                      onClick={() => openCreateModal(anchorDate, '10:00')}
                    >
                      <CalendarPlus size={15} aria-hidden="true" />
                      <span>Book on This Date</span>
                    </button>
                  </div>

                  {anchorDayEvents.length === 0 && anchorDayClasses.length === 0 ? (
                    <div className="glass-panel-subtle" style={{ textAlign: 'center', padding: '2rem' }}>
                      <p style={{ color: 'var(--ink-secondary)' }}>
                        No recurring classes or facility reservations recorded on {anchorDate} matching your filters.
                      </p>
                      <button
                        type="button"
                        className="btn btn-glass btn-sm"
                        style={{ marginTop: '0.85rem' }}
                        onClick={() => openCreateModal(anchorDate, '10:00')}
                      >
                        Schedule a Space
                      </button>
                    </div>
                  ) : (
                    <div className="schedule-list" style={{ gap: '0.75rem' }}>
                      {anchorDayClasses.map((cs) => {
                        const isVerified = cs.verificationStatus === VERIFICATION_STATUS.ADMIN_VERIFIED;
                        return (
                          <article
                            key={`day-cls-${cs.id}`}
                            className={`glass-panel-subtle ${getClassPillClass(cs.verificationStatus)}`}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.45rem',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                                <span className="class-time-nowrap" style={{ fontWeight: 700, fontSize: '0.96rem' }}>
                                  {formatTimeRange(cs.startTime, cs.endTime)}
                                </span>
                                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                  {cs.subjectCode}
                                </span>
                                <span className="tabular" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                  {cs.section}
                                </span>
                              </div>

                              <span style={{ fontSize: '0.76rem', fontWeight: 700 }}>
                                Recurring Weekly Class
                              </span>
                            </div>

                            <div className="meta-line" style={{ color: 'inherit', opacity: 0.9 }}>
                              <span>
                                {cs.facilityId
                                  ? `${cs.facilityCode ? `${cs.facilityCode} · ` : ''}${cs.facilityName}`
                                  : 'Facility: Unspecified'}
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
                                <span>{formatVerificationLabel(cs.verificationStatus)}</span>
                              </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                className="btn btn-glass btn-sm"
                                onClick={() => setSelectedClassSchedule({ ...cs, occurrenceDate: anchorDate })}
                              >
                                View Class Details
                              </button>
                            </div>
                          </article>
                        );
                      })}

                      {anchorDayEvents.map((ev) => (
                        <article
                          key={`day-res-${ev.id}`}
                          className="glass-panel-subtle"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.55rem',
                            borderColor: ev.conflict ? 'rgba(251, 113, 133, 0.7)' : undefined,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <span className="tabular" style={{ fontWeight: 700, fontSize: '0.98rem' }}>
                                {ev.startTime}–{ev.endTime}
                              </span>
                              <span className="meta-line">
                                <span className="tabular">{ev.facilityCode}</span>
                                <span aria-hidden="true">·</span>
                                <span>{ev.facilityName}</span>
                              </span>
                            </div>

                            <span
                              className={`status-text status-${ev.status.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              {ev.status}
                            </span>
                          </div>

                          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{ev.purpose}</div>

                          <div className="meta-line">
                            <span>
                              {ev.facilityBuilding}
                              {ev.facilityFloor ? ` · ${ev.facilityFloor}` : ''}
                            </span>
                            {ev.academicBlock && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="tabular">{ev.academicBlock}</span>
                              </>
                            )}
                            {ev.attendeesCount && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="tabular">{ev.attendeesCount} attendees</span>
                              </>
                            )}
                            {ev.userFullName && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{ev.userFullName}</span>
                              </>
                            )}
                          </div>

                          {ev.conflict && (
                            <div className="alert-banner alert-error" style={{ padding: '0.55rem 0.75rem' }}>
                              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                              <span>Conflict: {ev.conflict.reasons.join('; ')}</span>
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="btn btn-glass btn-sm"
                              onClick={() => openEventDetail(ev)}
                            >
                              {isAdmin ? 'Inspect / Manage' : 'View Details'}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>

                {/* Hourly Quick-Reserve Rail */}
                <aside className="glass-panel-subtle" aria-label="Hourly availability slots">
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>Hourly Schedule Windows</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', marginBottom: '0.85rem' }}>
                    Click an open hour to pre-fill a reservation request for {anchorDate}.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '460px', overflowY: 'auto' }}>
                    {HOURS.map((hr) => {
                      const hrStart = hr * 60;
                      const hrEnd = (hr + 1) * 60;
                      const overlappingBookings = anchorDayEvents.filter((ev) => {
                        if (ev.status !== 'Confirmed' && ev.status !== 'Pending') return false;
                        return timeToMinutes(ev.startTime) < hrEnd && hrStart < timeToMinutes(ev.endTime);
                      });
                      const overlappingClasses = anchorDayClasses.filter(
                        (cs) => timeToMinutes(cs.startTime) < hrEnd && hrStart < timeToMinutes(cs.endTime)
                      );
                      const occupiedLabels = [
                        ...overlappingClasses.map(
                          (cs) => `${cs.subjectCode} (${cs.facilityId ? cs.facilityCode || cs.facilityName : 'Unspecified'})`
                        ),
                        ...overlappingBookings.map((o) => `${o.facilityCode} (${o.status})`),
                      ];
                      return (
                        <div
                          key={hr}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            padding: '0.45rem 0.65rem',
                            borderRadius: '9px',
                            background: occupiedLabels.length ? 'var(--bg-tint-blue)' : 'var(--surface-card)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <span className="tabular" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            {formatHourLabel(hr)}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--ink-secondary)', flex: 1 }}>
                            {occupiedLabels.length > 0 ? occupiedLabels.join(', ') : 'Open window'}
                          </span>
                          <button
                            type="button"
                            className="btn btn-glass btn-sm"
                            style={{ minHeight: '30px', padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}
                            onClick={() => openCreateModal(anchorDate, formatHourLabel(hr))}
                          >
                            Reserve
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </aside>
              </div>
            )}

            {/* Empty Period State */}
            {events.length === 0 && (!showClasses || classSchedules.length === 0) && view !== 'day' && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '1.15rem',
                  borderRadius: '12px',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <span style={{ fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
                  No scheduled reservations or recurring classes found in this {view} range for the selected filters.
                </span>
                <button
                  type="button"
                  className="btn btn-coral btn-sm"
                  onClick={() => openCreateModal(selectedDate)}
                >
                  Schedule a Facility
                </button>
              </div>
            )}
          </>
        )}
      </motion.section>

      {/* Event Detail & Management Modal */}
      {selectedEvent && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`Reservation #${selectedEvent.id} details`}
        >
          <div className="modal-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <div className="meta-line">
                  <span className="tabular">#{selectedEvent.id}</span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={`status-text status-${selectedEvent.status.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {selectedEvent.status}
                  </span>
                </div>
                <h2 style={{ fontSize: '1.25rem', marginTop: '0.2rem' }}>
                  {selectedEvent.facilityCode} — {selectedEvent.facilityName}
                </h2>
              </div>

              <button
                type="button"
                className="icon-btn"
                aria-label="Close reservation detail"
                onClick={() => setSelectedEvent(null)}
              >
                <X size={18} />
              </button>
            </div>

            {selectedEvent.conflict && (
              <div className="alert-banner alert-error" role="alert" style={{ marginBottom: '0.9rem' }}>
                <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  Conflict Alert: {selectedEvent.conflict.reasons.join(' · ')}
                </span>
              </div>
            )}

            {detailError && (
              <div className="alert-banner alert-error" role="alert" style={{ marginBottom: '0.9rem' }}>
                {detailError}
              </div>
            )}

            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '0.75rem',
                margin: '0 0 1rem',
                padding: '0.85rem',
                borderRadius: '12px',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.86rem',
              }}
            >
              <div>
                <dt style={{ color: 'var(--ink-muted)', fontSize: '0.76rem' }}>Date &amp; Window</dt>
                <dd style={{ margin: '0.15rem 0 0', fontWeight: 600 }} className="tabular">
                  <CalendarIcon size={13} style={{ display: 'inline', marginRight: '0.3rem' }} />
                  {selectedEvent.reservationDate} · {selectedEvent.startTime}–{selectedEvent.endTime}
                </dd>
              </div>
              <div>
                <dt style={{ color: 'var(--ink-muted)', fontSize: '0.76rem' }}>Location</dt>
                <dd style={{ margin: '0.15rem 0 0', fontWeight: 600 }}>
                  <MapPin size={13} style={{ display: 'inline', marginRight: '0.3rem' }} />
                  {selectedEvent.facilityBuilding}
                  {selectedEvent.facilityFloor ? ` · ${selectedEvent.facilityFloor}` : ''}
                </dd>
              </div>
              <div>
                <dt style={{ color: 'var(--ink-muted)', fontSize: '0.76rem' }}>Requester</dt>
                <dd style={{ margin: '0.15rem 0 0', fontWeight: 600 }}>
                  {selectedEvent.userFullName}
                  {selectedEvent.userRole ? ` (${selectedEvent.userRole})` : ''}
                </dd>
              </div>
              <div>
                <dt style={{ color: 'var(--ink-muted)', fontSize: '0.76rem' }}>Attendees &amp; Block</dt>
                <dd style={{ margin: '0.15rem 0 0', fontWeight: 600 }} className="tabular">
                  <Users size={13} style={{ display: 'inline', marginRight: '0.3rem' }} />
                  {selectedEvent.attendeesCount ?? 'Private'}
                  {selectedEvent.academicBlock ? ` · ${selectedEvent.academicBlock}` : ''}
                </dd>
              </div>
            </dl>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginBottom: '0.25rem' }}>
                Purpose / Notes
              </div>
              <p style={{ fontSize: '0.92rem', color: 'var(--ink-primary)' }}>{selectedEvent.purpose}</p>
              {selectedEvent.reviewNote && (
                <p style={{ fontSize: '0.84rem', color: 'var(--ink-secondary)', marginTop: '0.35rem' }}>
                  Review note: {selectedEvent.reviewNote}
                </p>
              )}
            </div>

            {/* Admin Management & Conflict-Checked Reschedule */}
            {isAdmin && (
              <div
                style={{
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--glass-border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                }}
              >
                <div className="field-group">
                  <label htmlFor="detail-review-note" className="field-label">
                    Administrative Note
                  </label>
                  <input
                    id="detail-review-note"
                    type="text"
                    className="field-input"
                    placeholder="Optional note for requester..."
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                  />
                </div>

                {rescheduleMode ? (
                  <form onSubmit={handleRescheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="field-group">
                      <label htmlFor="resched-facility" className="field-label">Target Facility</label>
                      <select
                        id="resched-facility"
                        className="field-select"
                        value={rescheduleForm.facilityId}
                        onChange={(e) => setRescheduleForm({ ...rescheduleForm, facilityId: e.target.value })}
                      >
                        {facilities.map((f) => (
                          <option key={f.id} value={String(f.id)}>
                            {f.code} · {f.name} ({f.status})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-grid-2">
                      <div className="field-group">
                        <label htmlFor="resched-date" className="field-label">New Date</label>
                        <input
                          id="resched-date"
                          type="date"
                          className="field-input"
                          required
                          value={rescheduleForm.reservationDate}
                          onChange={(e) => setRescheduleForm({ ...rescheduleForm, reservationDate: e.target.value })}
                        />
                      </div>
                      <div className="form-grid-2">
                        <div className="field-group">
                          <label htmlFor="resched-start" className="field-label">Start</label>
                          <input
                            id="resched-start"
                            type="time"
                            className="field-input"
                            required
                            value={rescheduleForm.startTime}
                            onChange={(e) => setRescheduleForm({ ...rescheduleForm, startTime: e.target.value })}
                          />
                        </div>
                        <div className="field-group">
                          <label htmlFor="resched-end" className="field-label">End</label>
                          <input
                            id="resched-end"
                            type="time"
                            className="field-input"
                            required
                            value={rescheduleForm.endTime}
                            onChange={(e) => setRescheduleForm({ ...rescheduleForm, endTime: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button type="submit" className="btn btn-coral btn-sm" disabled={detailBusy}>
                        {detailBusy ? 'Validating...' : 'Save Reschedule'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-glass btn-sm"
                        onClick={() => setRescheduleMode(false)}
                      >
                        Cancel Edit
                      </button>
                    </div>
                  </form>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {selectedEvent.status === 'Pending' && (
                      <button
                        type="button"
                        className="btn btn-coral btn-sm"
                        disabled={detailBusy}
                        onClick={() => handleAdminReview('Confirmed')}
                      >
                        Approve Booking
                      </button>
                    )}
                    {selectedEvent.status === 'Confirmed' && (
                      <button
                        type="button"
                        className="btn btn-glass btn-sm"
                        disabled={detailBusy}
                        onClick={() => handleAdminReview('Completed')}
                      >
                        Mark Completed
                      </button>
                    )}
                    {(selectedEvent.status === 'Pending' || selectedEvent.status === 'Confirmed') && (
                      <>
                        <button
                          type="button"
                          className="btn btn-glass btn-sm"
                          disabled={detailBusy}
                          onClick={() => setRescheduleMode(true)}
                        >
                          <Clock size={14} aria-hidden="true" />
                          <span>Reschedule</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger-ghost btn-sm"
                          disabled={detailBusy}
                          onClick={() => handleAdminReview('Rejected')}
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Owner Cancel Action */}
            {!isAdmin &&
              selectedEvent.isMine &&
              (selectedEvent.status === 'Pending' || selectedEvent.status === 'Confirmed') && (
                <div
                  style={{
                    paddingTop: '1rem',
                    borderTop: '1px solid var(--glass-border-subtle)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-danger-ghost btn-sm"
                    disabled={detailBusy}
                    onClick={handleCancelSelected}
                  >
                    {detailBusy ? 'Cancelling...' : 'Cancel My Reservation'}
                  </button>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Create Reservation / Schedule Block Modal */}
      {createOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={isAdmin ? 'Create facility schedule block' : 'Request facility reservation'}
        >
          <div className="modal-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem' }}>
                {isAdmin ? 'Create Facility Schedule Block' : 'Request Facility Reservation'}
              </h2>
              <button
                type="button"
                className="icon-btn"
                aria-label="Close schedule modal"
                onClick={() => setCreateOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {createError && (
              <div className="alert-banner alert-error" role="alert" style={{ marginBottom: '0.9rem' }}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div className="field-group">
                <label htmlFor="cal-new-facility" className="field-label">
                  CICS Learning Facility
                </label>
                <select
                  id="cal-new-facility"
                  className="field-select"
                  required
                  value={createForm.facilityId}
                  onChange={(e) => setCreateForm({ ...createForm, facilityId: e.target.value })}
                >
                  {(facilities.some((f) => f.isReservable !== false)
                    ? facilities.filter((f) => f.isReservable !== false)
                    : facilities
                  ).map((f) => (
                    <option key={f.id} value={String(f.id)}>
                      {f.code} · {f.name} ({f.floor},{' '}
                      {f.capacity != null ? `Cap. ${f.capacity}` : 'Cap. Unspecified'}, {f.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-grid-2">
                <div className="field-group">
                  <label htmlFor="cal-new-date" className="field-label">Date</label>
                  <input
                    id="cal-new-date"
                    type="date"
                    className="field-input"
                    required
                    value={createForm.reservationDate}
                    onChange={(e) => setCreateForm({ ...createForm, reservationDate: e.target.value })}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="cal-new-attendees" className="field-label">Expected Attendees</label>
                  <input
                    id="cal-new-attendees"
                    type="number"
                    min="1"
                    className="field-input"
                    required
                    value={createForm.attendeesCount}
                    onChange={(e) => setCreateForm({ ...createForm, attendeesCount: e.target.value })}
                  />
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="cal-new-block" className="field-label">
                  Academic Block (Optional)
                </label>
                <input
                  id="cal-new-block"
                  type="text"
                  className="field-input"
                  maxLength={12}
                  placeholder="e.g. IT-3106 (leave blank if N/A)"
                  value={createForm.academicBlock}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, academicBlock: e.target.value.toUpperCase() })
                  }
                />
              </div>

              <div className="form-grid-2">
                <div className="field-group">
                  <label htmlFor="cal-new-start" className="field-label">Start Time</label>
                  <input
                    id="cal-new-start"
                    type="time"
                    className="field-input"
                    required
                    value={createForm.startTime}
                    onChange={(e) => setCreateForm({ ...createForm, startTime: e.target.value })}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="cal-new-end" className="field-label">End Time</label>
                  <input
                    id="cal-new-end"
                    type="time"
                    className="field-input"
                    required
                    value={createForm.endTime}
                    onChange={(e) => setCreateForm({ ...createForm, endTime: e.target.value })}
                  />
                </div>
              </div>

              {isAdmin && (
                <div className="field-group">
                  <label htmlFor="cal-new-status" className="field-label">Initial Schedule Status</label>
                  <select
                    id="cal-new-status"
                    className="field-select"
                    value={createForm.status}
                    onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
                  >
                    <option value="Confirmed">Confirmed (Official Schedule)</option>
                    <option value="Pending">Pending Review</option>
                  </select>
                </div>
              )}

              <div className="field-group">
                <label htmlFor="cal-new-purpose" className="field-label">Purpose / Course / Event</label>
                <textarea
                  id="cal-new-purpose"
                  className="field-textarea"
                  required
                  minLength={5}
                  maxLength={300}
                  placeholder="Describe the session, seminar, or facility activity..."
                  value={createForm.purpose}
                  onChange={(e) => setCreateForm({ ...createForm, purpose: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
                <button type="button" className="btn btn-glass" onClick={() => setCreateOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-coral" disabled={createBusy}>
                  {createBusy ? 'Checking Conflicts...' : isAdmin ? 'Save Schedule Block' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Read-Only Recurring Class Schedule Detail Modal */}
      {selectedClassSchedule && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`Recurring class schedule ${selectedClassSchedule.subjectCode}`}
        >
          <div className="modal-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <div className="meta-line">
                  <span style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>
                    Recurring Weekly Academic Class
                  </span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={`verification-label ${
                      selectedClassSchedule.verificationStatus === VERIFICATION_STATUS.ADMIN_VERIFIED
                        ? 'verification-label-verified'
                        : 'verification-label-unverified'
                    }`}
                  >
                    {selectedClassSchedule.verificationStatus === VERIFICATION_STATUS.ADMIN_VERIFIED ? (
                      <CheckCircle2 size={13} aria-hidden="true" />
                    ) : (
                      <AlertCircle size={13} aria-hidden="true" />
                    )}
                    <span>{formatVerificationLabel(selectedClassSchedule.verificationStatus)}</span>
                  </span>
                </div>
                <h2 style={{ fontSize: '1.25rem', marginTop: '0.25rem' }}>
                  {selectedClassSchedule.subjectCode} — {selectedClassSchedule.section}
                </h2>
              </div>

              <button
                type="button"
                className="icon-btn"
                aria-label="Close recurring class detail"
                onClick={() => setSelectedClassSchedule(null)}
              >
                <X size={18} />
              </button>
            </div>

            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '0.75rem',
                margin: '0 0 1rem',
                padding: '0.85rem',
                borderRadius: '12px',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.86rem',
              }}
            >
              <div>
                <dt style={{ color: 'var(--ink-muted)', fontSize: '0.76rem' }}>Recurrence &amp; Time</dt>
                <dd style={{ margin: '0.15rem 0 0', fontWeight: 600 }}>
                  Every {selectedClassSchedule.dayOfWeek} ·{' '}
                  <span className="class-time-nowrap">
                    {formatTimeRange(selectedClassSchedule.startTime, selectedClassSchedule.endTime)}
                  </span>
                </dd>
              </div>
              <div>
                <dt style={{ color: 'var(--ink-muted)', fontSize: '0.76rem' }}>Mapped Facility</dt>
                <dd style={{ margin: '0.15rem 0 0', fontWeight: 600 }}>
                  {selectedClassSchedule.facilityId
                    ? `${selectedClassSchedule.facilityName}${selectedClassSchedule.facilityCode ? ` (${selectedClassSchedule.facilityCode})` : ''}`
                    : 'Unspecified'}
                </dd>
              </div>
              <div>
                <dt style={{ color: 'var(--ink-muted)', fontSize: '0.76rem' }}>Section / Program</dt>
                <dd style={{ margin: '0.15rem 0 0', fontWeight: 600 }} className="tabular">
                  {selectedClassSchedule.section}
                </dd>
              </div>
              <div>
                <dt style={{ color: 'var(--ink-muted)', fontSize: '0.76rem' }}>Building &amp; Floor</dt>
                <dd style={{ margin: '0.15rem 0 0', fontWeight: 600 }}>
                  {selectedClassSchedule.facilityId
                    ? `${selectedClassSchedule.facilityBuilding || 'CICS Building'}${selectedClassSchedule.facilityFloor ? ` · ${selectedClassSchedule.facilityFloor}` : ''}`
                    : 'No room assigned'}
                </dd>
              </div>
            </dl>

            <p style={{ fontSize: '0.84rem', color: 'var(--ink-secondary)', marginBottom: '1rem' }}>
              This is a read-only recurring academic class entry separate from one-time reservation requests.
              {selectedClassSchedule.facilityId
                ? ' Overlapping facility reservations for this room on this weekday are automatically blocked.'
                : ' Because no facility is mapped, this entry does not block room reservations.'}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', flexWrap: 'wrap' }}>
              {isAdmin && (
                <Link
                  to="/app/admin/schedules"
                  className="btn btn-coral btn-sm"
                  onClick={() => setSelectedClassSchedule(null)}
                >
                  Manage in Admin Schedules
                </Link>
              )}
              <button
                type="button"
                className="btn btn-glass btn-sm"
                onClick={() => setSelectedClassSchedule(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
