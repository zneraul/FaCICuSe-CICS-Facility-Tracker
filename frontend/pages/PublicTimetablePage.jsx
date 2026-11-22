import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  Search,
} from 'lucide-react';
import { PublicLayout } from '../components/PublicLayout.jsx';
import { apiRequest } from '../services/api.js';
import {
  ALL_WEEKDAYS,
  CLASS_SCHEDULES_DIRTY_EVENT,
  NON_INSTRUCTIONAL_WEEKDAYS,
  VERIFICATION_STATUS,
  formatTimeRange,
  formatVerificationLabel,
} from '../utils/classScheduleUtils.js';

export function PublicTimetablePage() {
  const [schedules, setSchedules] = useState([]);
  const [sections, setSections] = useState([]);
  const [nonInstructionalDays, setNonInstructionalDays] = useState(NON_INSTRUCTIONAL_WEEKDAYS);
  const [todaySummary, setTodaySummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [weekdayFilter, setWeekdayFilter] = useState('All');
  const [sectionFilter, setSectionFilter] = useState('All');
  const [search, setSearch] = useState('');

  const loadTimetable = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [allRes, todayRes] = await Promise.all([
        apiRequest('/public/class-schedules'),
        apiRequest('/public/class-schedules/today').catch(() => null),
      ]);
      setSchedules(allRes.schedules || []);
      setSections(allRes.sections || []);
      if (Array.isArray(allRes.nonInstructionalWeekdays)) {
        setNonInstructionalDays(allRes.nonInstructionalWeekdays);
      }
      setTodaySummary(todayRes);
    } catch (err) {
      setError(err.message || 'Unable to load CICS weekly class timetable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTimetable();
    const handleDirty = () => loadTimetable();
    window.addEventListener(CLASS_SCHEDULES_DIRTY_EVENT, handleDirty);
    return () => window.removeEventListener(CLASS_SCHEDULES_DIRTY_EVENT, handleDirty);
  }, [loadTimetable]);

  const filteredSchedules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return schedules.filter((item) => {
      if (weekdayFilter !== 'All' && item.dayOfWeek !== weekdayFilter) return false;
      if (sectionFilter !== 'All' && item.section !== sectionFilter) return false;
      if (q) {
        const hay = `${item.subjectCode} ${item.section} ${item.dayOfWeek} ${item.facilityName || 'Unspecified'} ${item.facilityCode || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [schedules, weekdayFilter, sectionFilter, search]);

  const groupedByDay = useMemo(() => {
    const daysToRender =
      weekdayFilter === 'All' ? ALL_WEEKDAYS : [weekdayFilter];

    return daysToRender.map((day) => ({
      day,
      isNonInstructional: nonInstructionalDays.includes(day),
      items: filteredSchedules.filter((item) => item.dayOfWeek === day),
    }));
  }, [filteredSchedules, weekdayFilter, nonInstructionalDays]);

  return (
    <PublicLayout>
      <section aria-labelledby="public-timetable-heading" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span className="section-kicker">CICS Building · Weekly Academic Reference</span>
              <h1 id="public-timetable-heading" className="section-title">
                CICS Recurring Class Timetable
              </h1>
              <p style={{ fontSize: '0.93rem', color: 'var(--ink-secondary)', marginTop: '0.35rem', maxWidth: '64ch' }}>
                In-person recurring academic class schedules assigned to CICS Building classrooms and laboratories.
                Verification status distinguishes administrator-verified schedules from supplied reference entries.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <Link to="/facilities" className="btn btn-glass btn-sm">
                Browse All 38 Spaces
              </Link>
              <Link to="/app/calendar" className="btn btn-coral btn-sm">
                <CalendarDays size={15} aria-hidden="true" />
                <span>Open Full Calendar</span>
              </Link>
            </div>
          </div>

          {todaySummary && (
            <div
              className="alert-banner alert-info"
              role="status"
              style={{ alignItems: 'center', justifyContent: 'space-between' }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                <Clock size={16} aria-hidden="true" />
                <span>
                  Today in Asia/Manila: <strong>{todaySummary.weekday}</strong> ({todaySummary.manilaDate}) —{' '}
                  {todaySummary.isNonInstructionalDay
                    ? 'Configured non-instructional / rest day (no recurring in-person classes).'
                    : todaySummary.schedules?.length > 0
                      ? `${todaySummary.schedules.length} recurring class${todaySummary.schedules.length === 1 ? '' : 'es'} scheduled.`
                      : 'No recurring classes recorded for today.'}
                </span>
              </span>
              <span className="tabular" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                {schedules.length} stored weekly {schedules.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
          )}

          <div className="filter-bar-grid" style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
            <div className="field-group">
              <label htmlFor="timetable-search" className="field-label">
                Search timetable
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
                  id="timetable-search"
                  type="search"
                  className="field-input"
                  style={{ paddingLeft: '2.2rem' }}
                  placeholder="Subject code, section, room..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="timetable-day" className="field-label">
                Weekday
              </label>
              <select
                id="timetable-day"
                className="field-select"
                value={weekdayFilter}
                onChange={(e) => setWeekdayFilter(e.target.value)}
              >
                <option value="All">All Weekdays (Mon–Sat)</option>
                {ALL_WEEKDAYS.map((day) => (
                  <option key={day} value={day}>
                    {nonInstructionalDays.includes(day) ? `${day} (Non-instructional)` : day}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label htmlFor="timetable-section" className="field-label">
                Section / Program
              </label>
              <select
                id="timetable-section"
                className="field-select"
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
            </div>
          </div>
        </div>

        {error && (
          <div className="alert-banner alert-error" role="alert">
            <span>{error}</span>
            <button
              type="button"
              className="btn btn-glass btn-sm"
              style={{ marginLeft: 'auto' }}
              onClick={loadTimetable}
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '2.5rem' }}>
            Loading CICS recurring class schedules...
          </div>
        ) : (
          <div className="timetable-weekday-grid">
            {groupedByDay.map(({ day, isNonInstructional, items }) => (
              <article key={day} className="glass-panel" aria-label={`${day} recurring classes`}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    paddingBottom: '0.7rem',
                    marginBottom: '0.75rem',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--ink-primary)' }}>
                    {day}
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }} className="tabular">
                    {isNonInstructional
                      ? 'Non-instructional day'
                      : `${items.length} ${items.length === 1 ? 'class' : 'classes'}`}
                  </span>
                </div>

                {isNonInstructional ? (
                  <p style={{ fontSize: '0.86rem', color: 'var(--ink-secondary)' }}>
                    Configured campus rest / non-instructional day. Recurring in-person class schedules are not placed on {day}.
                  </p>
                ) : items.length === 0 ? (
                  <p style={{ fontSize: '0.86rem', color: 'var(--ink-muted)' }}>
                    No recurring class schedules recorded for {day}
                    {sectionFilter !== 'All' ? ` (${sectionFilter})` : ''}.
                  </p>
                ) : (
                  <div className="schedule-list">
                    {items.map((item) => {
                      const isVerified =
                        item.verificationStatus === VERIFICATION_STATUS.ADMIN_VERIFIED;
                      return (
                        <div key={item.id} className="class-schedule-row">
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                              <BookOpen size={14} aria-hidden="true" style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                              <strong style={{ fontSize: '0.94rem', color: 'var(--ink-primary)' }}>
                                {item.subjectCode}
                              </strong>
                              <span className="tabular" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-blue)' }}>
                                {item.section}
                              </span>
                            </div>

                            <div className="meta-line" style={{ marginTop: '0.28rem' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <MapPin size={12} aria-hidden="true" />
                                {item.facilityId ? (
                                  <Link
                                    to={`/facilities/${item.facilityId}`}
                                    style={{ color: 'var(--ink-secondary)', fontWeight: 500 }}
                                  >
                                    {item.facilityName}
                                  </Link>
                                ) : (
                                  <span>Unspecified</span>
                                )}
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
                                <span>{formatVerificationLabel(item.verificationStatus)}</span>
                              </span>
                            </div>
                          </div>

                          <span
                            className="class-time-nowrap"
                            style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--ink-primary)' }}
                          >
                            {formatTimeRange(item.startTime, item.endTime)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
