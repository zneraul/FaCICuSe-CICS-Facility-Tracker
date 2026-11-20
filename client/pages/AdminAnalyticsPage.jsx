import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { AppShell } from '../components/AppShell.jsx';
import { apiRequest } from '../services/api.js';
import { addDays, toIsoDate } from '../utils/calendarUtils.js';

const STATUS_COLORS = {
  Confirmed: '#1d4ed8',
  Pending: '#d97706',
  Completed: '#059669',
  Rejected: '#dc2626',
  Cancelled: '#64748b',
};

const RESERVATION_STATUSES = ['All', 'Confirmed', 'Pending', 'Completed', 'Rejected', 'Cancelled'];

function buildSmoothLinePath(points) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const cx = ((prev.x + curr.x) / 2).toFixed(1);
    d += ` C ${cx} ${prev.y.toFixed(1)}, ${cx} ${curr.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
  }
  return d;
}

export function AdminAnalyticsPage() {
  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  const [filters, setFilters] = useState({
    search: '',
    category: 'All',
    floor: 'All',
    status: 'All',
    startDate: '',
    endDate: '',
  });
  const [activePreset, setActivePreset] = useState('all');

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const [hoveredDate, setHoveredDate] = useState(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState(null);

  const loadAnalytics = useCallback(async (activeFilters) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (activeFilters.search.trim()) params.set('search', activeFilters.search.trim());
      if (activeFilters.category !== 'All') params.set('category', activeFilters.category);
      if (activeFilters.floor !== 'All') params.set('floor', activeFilters.floor);
      if (activeFilters.status !== 'All') params.set('status', activeFilters.status);
      if (activeFilters.startDate) params.set('startDate', activeFilters.startDate);
      if (activeFilters.endDate) params.set('endDate', activeFilters.endDate);

      const qs = params.toString();
      const res = await apiRequest(`/admin/analytics${qs ? `?${qs}` : ''}`);
      setAnalytics(res);
      setHoveredDate(null);
      setSelectedFacilityId((prevId) => {
        if (!prevId) return null;
        return (res.facilityBreakdown || []).some((f) => f.facilityId === prevId) ? prevId : null;
      });
    } catch (err) {
      setError(err.message || 'Unable to load administrative analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAnalytics(filters);
    }, 180);
    return () => clearTimeout(timer);
  }, [filters, loadAnalytics]);

  function applyPreset(preset) {
    setActivePreset(preset);
    if (preset === 'all') {
      setFilters((prev) => ({ ...prev, startDate: '', endDate: '' }));
    } else if (preset === '14d') {
      setFilters((prev) => ({
        ...prev,
        startDate: addDays(todayIso, -7),
        endDate: addDays(todayIso, 14),
      }));
    } else if (preset === '30d') {
      setFilters((prev) => ({
        ...prev,
        startDate: todayIso,
        endDate: addDays(todayIso, 30),
      }));
    }
  }

  function resetAllFilters() {
    setActivePreset('all');
    setFilters({
      search: '',
      category: 'All',
      floor: 'All',
      status: 'All',
      startDate: '',
      endDate: '',
    });
  }

  async function handleExportCsv() {
    setExporting(true);
    setError('');
    try {
      const csvText = await apiRequest('/admin/analytics/export.csv');
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'facicuse-reservations-report.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Failed to export CSV report.');
    } finally {
      setExporting(false);
    }
  }

  const exportButton = (
    <button
      type="button"
      className="btn btn-coral btn-sm"
      disabled={exporting || !analytics}
      onClick={handleExportCsv}
    >
      <Download size={15} aria-hidden="true" />
      <span>{exporting ? 'Exporting...' : 'Export CSV Report'}</span>
    </button>
  );

  // Derived SVG chart data (strictly from real API payload)
  const trendSeries = analytics?.activityOverTime || [];
  const chartGeometry = useMemo(() => {
    if (trendSeries.length === 0) return null;
    const width = 660;
    const height = 230;
    const padL = 36;
    const padR = 20;
    const padT = 18;
    const padB = 34;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;

    const rawMax = Math.max(
      2,
      ...trendSeries.map((d) => Math.max(d.totalRequests, d.scheduledHours))
    );
    const maxY = Math.ceil(rawMax);

    const reqPoints = trendSeries.map((d, idx) => {
      const x =
        trendSeries.length === 1
          ? padL + innerW / 2
          : padL + (idx / (trendSeries.length - 1)) * innerW;
      const y = padT + innerH - (d.totalRequests / maxY) * innerH;
      return { ...d, x, y };
    });

    const hourPoints = trendSeries.map((d, idx) => {
      const x =
        trendSeries.length === 1
          ? padL + innerW / 2
          : padL + (idx / (trendSeries.length - 1)) * innerW;
      const y = padT + innerH - (d.scheduledHours / maxY) * innerH;
      return { ...d, x, y };
    });

    const reqPath = buildSmoothLinePath(reqPoints);
    const hourPath = buildSmoothLinePath(hourPoints);
    const baseY = padT + innerH;
    const reqArea =
      reqPoints.length > 0
        ? `${reqPath} L ${reqPoints[reqPoints.length - 1].x.toFixed(1)} ${baseY} L ${reqPoints[0].x.toFixed(1)} ${baseY} Z`
        : '';

    return {
      width,
      height,
      padL,
      padT,
      innerW,
      innerH,
      baseY,
      maxRequests: maxY,
      reqPoints,
      hourPoints,
      reqPath,
      hourPath,
      reqArea,
    };
  }, [trendSeries]);

  const statusEntries = useMemo(() => {
    const map = analytics?.reservationsByStatus || {};
    return Object.entries(map).map(([status, count]) => ({
      status,
      count,
      color: STATUS_COLORS[status] || '#818cf8',
    }));
  }, [analytics]);

  const totalStatusCount = useMemo(
    () => statusEntries.reduce((sum, item) => sum + item.count, 0),
    [statusEntries]
  );

  const donutSegments = useMemo(() => {
    const r = 58;
    const circumference = 2 * Math.PI * r;
    let offset = 0;
    return statusEntries
      .filter((item) => item.count > 0)
      .map((item) => {
        const ratio = totalStatusCount > 0 ? item.count / totalStatusCount : 0;
        const dash = ratio * circumference;
        const segment = {
          ...item,
          dash,
          gap: circumference - dash,
          offset,
          pct: Math.round(ratio * 100),
        };
        offset += dash;
        return segment;
      });
  }, [statusEntries, totalStatusCount]);

  const facilitySorted = useMemo(() => {
    const rows = analytics?.facilityBreakdown || [];
    return [...rows].sort((a, b) => b.totalRequests - a.totalRequests || b.scheduledHours - a.scheduledHours);
  }, [analytics]);

  const selectedFacility = useMemo(
    () => facilitySorted.find((f) => f.facilityId === selectedFacilityId) || null,
    [facilitySorted, selectedFacilityId]
  );

  const maxFacilityRequests = Math.max(1, ...facilitySorted.map((f) => f.totalRequests));
  const maxPeakRequests = Math.max(
    1,
    ...(analytics?.peakBookingPeriods || []).map((p) => p.requests)
  );
  const maxWeekdayRequests = Math.max(
    1,
    ...(analytics?.weekdayDistribution || []).map((w) => w.requests)
  );
  const activePoint =
    trendSeries.find((d) => d.date === hoveredDate) ||
    (trendSeries.length > 0 ? trendSeries[trendSeries.length - 1] : null);

  return (
    <AppShell title="Administrative Analytics" primaryAction={exportButton}>
      <div className="analytics-workspace">
        {/* Top Transparency & Quick Range Bar */}
        <section className="analytics-top-banner" aria-label="Analytics scope and quick ranges">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', minWidth: 0 }}>
            <ShieldCheck size={18} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} aria-hidden="true" />
            <div>
              <strong style={{ fontSize: '0.9rem', color: 'var(--ink-primary)', display: 'block' }}>
                System Administrator Facility Intelligence
              </strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--ink-secondary)' }}>
                {analytics?.disclaimer ||
                  'All figures are aggregated directly from recorded FaCICuSe reservations, facilities, issues, and users.'}
              </span>
            </div>
          </div>

          <div className="analytics-preset-row" role="group" aria-label="Date range presets">
            <button
              type="button"
              className={`analytics-preset-btn ${activePreset === 'all' ? 'active' : ''}`}
              onClick={() => applyPreset('all')}
            >
              All Recorded
            </button>
            <button
              type="button"
              className={`analytics-preset-btn ${activePreset === '14d' ? 'active' : ''}`}
              onClick={() => applyPreset('14d')}
            >
              21-Day Window
            </button>
            <button
              type="button"
              className={`analytics-preset-btn ${activePreset === '30d' ? 'active' : ''}`}
              onClick={() => applyPreset('30d')}
            >
              Next 30 Days
            </button>
          </div>
        </section>

        {/* Server-Backed Filter Toolbar */}
        <section className="analytics-filter-bar" aria-label="Analytics filters">
          <div className="field-group">
            <label className="field-label" htmlFor="analytics-search">
              Search CICS Room
            </label>
            <div style={{ position: 'relative' }}>
              <Search
                size={15}
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
                id="analytics-search"
                type="search"
                className="field-input"
                style={{ paddingLeft: '2.1rem' }}
                placeholder="Code, name, or floor..."
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              />
            </div>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="analytics-category">
              Category
            </label>
            <select
              id="analytics-category"
              className="field-select"
              value={filters.category}
              onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
            >
              <option value="All">All Categories</option>
              {(analytics?.categoriesAvailable || []).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="analytics-floor">
              Building Floor
            </label>
            <select
              id="analytics-floor"
              className="field-select"
              value={filters.floor}
              onChange={(e) => setFilters((prev) => ({ ...prev, floor: e.target.value }))}
            >
              <option value="All">All 5 Floors</option>
              {(
                analytics?.floorsAvailable || [
                  'First Floor',
                  'Second Floor',
                  'Third Floor',
                  'Fourth Floor',
                  'Fifth Floor',
                ]
              ).map((fl) => (
                <option key={fl} value={fl}>
                  {fl}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="analytics-status">
              Reservation Status
            </label>
            <select
              id="analytics-status"
              className="field-select"
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            >
              {RESERVATION_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st === 'All' ? 'All Statuses' : st}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="analytics-start">
              From Date
            </label>
            <input
              id="analytics-start"
              type="date"
              className="field-input"
              value={filters.startDate}
              onChange={(e) => {
                setActivePreset('custom');
                setFilters((prev) => ({ ...prev, startDate: e.target.value }));
              }}
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="analytics-end">
              To Date
            </label>
            <input
              id="analytics-end"
              type="date"
              className="field-input"
              value={filters.endDate}
              onChange={(e) => {
                setActivePreset('custom');
                setFilters((prev) => ({ ...prev, endDate: e.target.value }));
              }}
            />
          </div>

          <button
            type="button"
            className="btn btn-glass btn-sm"
            onClick={resetAllFilters}
            title="Reset analytics filters"
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span>Reset</span>
          </button>
        </section>

        {error && (
          <div className="alert-banner alert-error" role="alert">
            {error}
          </div>
        )}

        {loading && !analytics ? (
          <div className="analytics-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
            Aggregating facility utilization and scheduling records...
          </div>
        ) : analytics ? (
          <>
            {/* 5 Real KPI Summary Cards */}
            <section className="analytics-kpi-grid" aria-label="Key facility indicators">
              <article className="analytics-kpi-card">
                <div className="analytics-kpi-head">
                  <span>Matched Facilities</span>
                  <Building2 size={15} aria-hidden="true" />
                </div>
                <div className="analytics-kpi-val">{analytics.totals.facilities}</div>
                <div className="analytics-kpi-foot">
                  <span className="tabular">{analytics.totals.availableFacilities}</span> available for booking
                </div>
              </article>

              <article className="analytics-kpi-card">
                <div className="analytics-kpi-head">
                  <span>Reservation Requests</span>
                  <CalendarClock size={15} aria-hidden="true" />
                </div>
                <div className="analytics-kpi-val">{analytics.totals.reservations}</div>
                <div className="analytics-kpi-foot">
                  {analytics.totals.approvalRatePct !== null ? (
                    <>
                      <span className="tabular">{analytics.totals.approvalRatePct}%</span> approval rate (reviewed)
                    </>
                  ) : (
                    'No reviewed requests in filter'
                  )}
                </div>
              </article>

              <article className="analytics-kpi-card">
                <div className="analytics-kpi-head">
                  <span>Scheduled Hours</span>
                  <Clock size={15} aria-hidden="true" />
                </div>
                <div className="analytics-kpi-val">{analytics.totals.confirmedScheduledHours}h</div>
                <div className="analytics-kpi-foot">
                  Avg slot: <span className="tabular">{analytics.totals.avgDurationHours}h</span> confirmed
                </div>
              </article>

              <article className="analytics-kpi-card">
                <div className="analytics-kpi-head">
                  <span>Maintenance Queue</span>
                  <Wrench size={15} aria-hidden="true" />
                </div>
                <div className="analytics-kpi-val">{analytics.totals.openIssues}</div>
                <div className="analytics-kpi-foot">
                  Out of <span className="tabular">{analytics.totals.issues}</span> total logged tickets
                </div>
              </article>

              <article className="analytics-kpi-card">
                <div className="analytics-kpi-head">
                  <span>Campus Accounts</span>
                  <Users size={15} aria-hidden="true" />
                </div>
                <div className="analytics-kpi-val">{analytics.totals.users}</div>
                <div className="analytics-kpi-foot">
                  {analytics.usersByRole.student} student · {analytics.usersByRole.professor} faculty ·{' '}
                  {analytics.usersByRole.admin} admin
                </div>
              </article>
            </section>

            {/* Primary Charts Row: Usage Trends Over Time + Status Distribution Donut */}
            <div className="analytics-grid-main">
              <article className="analytics-card">
                <div className="analytics-card-header">
                  <div>
                    <h2 className="analytics-card-title">Facility Usage &amp; Reservation Trends</h2>
                    <p className="analytics-card-sub">
                      Daily booking requests and confirmed scheduled hours across matching records
                    </p>
                  </div>
                  {activePoint && (
                    <div
                      style={{
                        padding: '0.35rem 0.7rem',
                        borderRadius: '8px',
                        background: 'var(--bg-tint-blue)',
                        border: '1px solid #bfdbfe',
                        fontSize: '0.78rem',
                        color: 'var(--ink-primary)',
                      }}
                    >
                      <strong className="tabular">{activePoint.date}</strong>:{' '}
                      <span className="tabular">{activePoint.totalRequests}</span> req ·{' '}
                      <span className="tabular">{activePoint.scheduledHours}h</span> confirmed
                    </div>
                  )}
                </div>

                {!chartGeometry ? (
                  <div className="analytics-empty">
                    No reservation records match the active filter criteria.
                  </div>
                ) : (
                  <figure className="analytics-chart-figure">
                    <div className="analytics-svg-wrap">
                      <svg
                        viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
                        role="img"
                        aria-label="Reservation requests and scheduled hours trend chart"
                        style={{ width: '100%', minWidth: '460px', height: 'auto', display: 'block' }}
                      >
                        <defs>
                          <linearGradient id="reqAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
                            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
                          </linearGradient>
                          <linearGradient id="reqLineGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#1d4ed8" />
                            <stop offset="100%" stopColor="#4f46e5" />
                          </linearGradient>
                        </defs>

                        {/* Horizontal grid lines */}
                        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
                          const y = chartGeometry.padT + chartGeometry.innerH * (1 - step);
                          const val = Math.round(chartGeometry.maxRequests * step);
                          return (
                            <g key={step}>
                              <line
                                x1={chartGeometry.padL}
                                y1={y}
                                x2={chartGeometry.width - 20}
                                y2={y}
                                stroke="#e2e8f0"
                                strokeDasharray="3 3"
                              />
                              <text
                                x={chartGeometry.padL - 8}
                                y={y + 4}
                                textAnchor="end"
                                fontSize="10"
                                fill="#64748b"
                              >
                                {val}
                              </text>
                            </g>
                          );
                        })}

                        <path d={chartGeometry.reqArea} fill="url(#reqAreaGrad)" />
                        <path
                          d={chartGeometry.reqPath}
                          fill="none"
                          stroke="url(#reqLineGrad)"
                          strokeWidth="2.8"
                          strokeLinecap="round"
                        />
                        <path
                          d={chartGeometry.hourPath}
                          fill="none"
                          stroke="#6366f1"
                          strokeWidth="2"
                          strokeDasharray="5 4"
                          strokeLinecap="round"
                        />

                        {chartGeometry.reqPoints.map((pt, index) => {
                          const showLabel =
                            chartGeometry.reqPoints.length <= 8 ||
                            index === 0 ||
                            index === chartGeometry.reqPoints.length - 1 ||
                            index % Math.ceil(chartGeometry.reqPoints.length / 6) === 0;
                          const isSelected = activePoint?.date === pt.date;
                          return (
                            <g
                              key={pt.date}
                              onMouseEnter={() => setHoveredDate(pt.date)}
                              style={{ cursor: 'pointer' }}
                            >
                              <circle
                                cx={pt.x}
                                cy={pt.y}
                                r={isSelected ? 6 : 4}
                                fill={isSelected ? '#1d4ed8' : '#2563eb'}
                                stroke="#ffffff"
                                strokeWidth="1.5"
                              />
                              <circle
                                cx={chartGeometry.hourPoints[index].x}
                                cy={chartGeometry.hourPoints[index].y}
                                r={3.2}
                                fill="#6366f1"
                              />
                              {showLabel && (
                                <text
                                  x={pt.x}
                                  y={chartGeometry.height - 8}
                                  textAnchor="middle"
                                  fontSize="10"
                                  fill="#64748b"
                                >
                                  {pt.date.slice(5)}
                                </text>
                              )}
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                    <figcaption className="analytics-chart-caption">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.85rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span className="analytics-swatch" style={{ background: '#1d4ed8' }} />
                          Reservation Requests
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span className="analytics-swatch" style={{ background: '#6366f1' }} />
                          Confirmed Scheduled Hours
                        </span>
                      </span>
                      <span>Hover any date point to inspect exact totals</span>
                    </figcaption>
                  </figure>
                )}
              </article>

              <article className="analytics-card">
                <div className="analytics-card-header">
                  <div>
                    <h2 className="analytics-card-title">Reservation Status Distribution</h2>
                    <p className="analytics-card-sub">
                      Share of recorded requests across lifecycle statuses
                    </p>
                  </div>
                </div>

                {totalStatusCount === 0 ? (
                  <div className="analytics-empty">
                    No reservations match the current filter selection.
                  </div>
                ) : (
                  <figure className="analytics-chart-figure">
                    <div className="analytics-donut-layout">
                      <svg
                        viewBox="0 0 160 160"
                        width="160"
                        height="160"
                        role="img"
                        aria-label="Reservation status donut chart"
                        style={{ margin: '0 auto' }}
                      >
                        <circle
                          cx="80"
                          cy="80"
                          r="58"
                          fill="none"
                          stroke="#e2e8f0"
                          strokeWidth="18"
                        />
                        <g transform="rotate(-90 80 80)">
                          {donutSegments.map((seg) => (
                            <circle
                              key={seg.status}
                              cx="80"
                              cy="80"
                              r="58"
                              fill="none"
                              stroke={seg.color}
                              strokeWidth="18"
                              strokeDasharray={`${seg.dash} ${seg.gap}`}
                              strokeDashoffset={-seg.offset}
                            />
                          ))}
                        </g>
                        <text
                          x="80"
                          y="76"
                          textAnchor="middle"
                          fontSize="24"
                          fontWeight="700"
                          fill="#0f172a"
                        >
                          {totalStatusCount}
                        </text>
                        <text x="80" y="96" textAnchor="middle" fontSize="11" fill="#64748b">
                          Total Requests
                        </text>
                      </svg>

                      <div className="analytics-legend-list">
                        {statusEntries.map((item) => {
                          const pct =
                            totalStatusCount > 0 ? Math.round((item.count / totalStatusCount) * 100) : 0;
                          return (
                            <div key={item.status} className="analytics-legend-row">
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span
                                  className="analytics-swatch"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span>{item.status}</span>
                              </span>
                              <span className="tabular" style={{ fontWeight: 600 }}>
                                {item.count}{' '}
                                <span style={{ color: '#64748b', fontWeight: 400 }}>({pct}%)</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </figure>
                )}
              </article>
            </div>

            {/* Secondary Grid: Peak Booking Windows, Weekday Activity, Category Utilization */}
            <div className="analytics-grid-3">
              <article className="analytics-card">
                <div className="analytics-card-header">
                  <div>
                    <h2 className="analytics-card-title">Peak Booking Periods</h2>
                    <p className="analytics-card-sub">Demand grouped by reservation start window</p>
                  </div>
                  <Activity size={16} style={{ color: 'var(--accent-blue)' }} aria-hidden="true" />
                </div>

                <div className="analytics-meter-list">
                  {analytics.peakBookingPeriods.map((bucket) => {
                    const pct = Math.round((bucket.requests / maxPeakRequests) * 100);
                    return (
                      <div key={bucket.period} className="analytics-meter-item">
                        <div className="analytics-meter-top">
                          <span>{bucket.period}</span>
                          <span className="tabular" style={{ fontWeight: 600 }}>
                            {bucket.requests} req · {bucket.scheduledHours}h
                          </span>
                        </div>
                        <div className="analytics-meter-track">
                          <div
                            className="analytics-meter-fill-blue"
                            style={{ width: `${bucket.requests > 0 ? Math.max(6, pct) : 0}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>

              <article className="analytics-card">
                <div className="analytics-card-header">
                  <div>
                    <h2 className="analytics-card-title">Weekday Scheduling Density</h2>
                    <p className="analytics-card-sub">Monday through Sunday request distribution</p>
                  </div>
                </div>

                <svg
                  viewBox="0 0 320 165"
                  role="img"
                  aria-label="Weekday reservation volume bar chart"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                >
                  <defs>
                    <linearGradient id="weekdayBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1d4ed8" />
                      <stop offset="100%" stopColor="#4f46e5" />
                    </linearGradient>
                  </defs>
                  {analytics.weekdayDistribution.map((wd, idx) => {
                    const barW = 24;
                    const x = 18 + idx * 42;
                    const barH =
                      wd.requests > 0 ? Math.max(8, (wd.requests / maxWeekdayRequests) * 105) : 3;
                    const y = 128 - barH;
                    return (
                      <g key={wd.day}>
                        <rect
                          x={x}
                          y={y}
                          width={barW}
                          height={barH}
                          rx="6"
                          fill={wd.requests > 0 ? 'url(#weekdayBarGrad)' : '#e2e8f0'}
                        />
                        <text
                          x={x + barW / 2}
                          y={y - 6}
                          textAnchor="middle"
                          fontSize="10"
                          fill="#0f172a"
                        >
                          {wd.requests}
                        </text>
                        <text
                          x={x + barW / 2}
                          y="150"
                          textAnchor="middle"
                          fontSize="10.5"
                          fill="#64748b"
                        >
                          {wd.day}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </article>

              <article className="analytics-card">
                <div className="analytics-card-header">
                  <div>
                    <h2 className="analytics-card-title">Maintenance Ticket Breakdown</h2>
                    <p className="analytics-card-sub">Status, priority, and category counts</p>
                  </div>
                  <Wrench size={16} style={{ color: 'var(--accent-indigo)' }} aria-hidden="true" />
                </div>

                {analytics.totals.issues === 0 ? (
                  <div className="analytics-empty">
                    No maintenance tickets logged for the matched facilities.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                        gap: '0.5rem',
                      }}
                    >
                      {Object.entries(analytics.issuesByStatus).map(([label, count]) => (
                        <div
                          key={label}
                          style={{
                            padding: '0.5rem 0.65rem',
                            borderRadius: '8px',
                            background: 'var(--bg-subtle)',
                            border: '1px solid var(--border-subtle)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.8rem',
                          }}
                        >
                          <span style={{ color: 'var(--ink-secondary)' }}>{label}</span>
                          <strong className="tabular" style={{ color: 'var(--ink-primary)' }}>{count}</strong>
                        </div>
                      ))}
                    </div>

                    <div className="analytics-meter-list">
                      {Object.entries(analytics.issuesByCategory).map(([cat, count]) => {
                        const pct = Math.round((count / Math.max(1, analytics.totals.issues)) * 100);
                        return (
                          <div key={cat} className="analytics-meter-item">
                            <div className="analytics-meter-top">
                              <span>{cat}</span>
                              <span className="tabular">
                                {count} ({pct}%)
                              </span>
                            </div>
                            <div className="analytics-meter-track">
                              <div
                                className="analytics-meter-fill-violet"
                                style={{ width: `${Math.max(8, pct)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </article>
            </div>

            {/* Category Utilization & Top Facilities Comparison */}
            <div className="analytics-grid-2">
              <article className="analytics-card">
                <div className="analytics-card-header">
                  <div>
                    <h2 className="analytics-card-title">Utilization by Space Category</h2>
                    <p className="analytics-card-sub">
                      Scheduled hours and request volume grouped by campus facility type
                    </p>
                  </div>
                </div>

                {analytics.categoryUtilization.length === 0 ? (
                  <div className="analytics-empty">No matching space categories found.</div>
                ) : (
                  <div className="analytics-meter-list">
                    {analytics.categoryUtilization.map((cat) => {
                      const maxCatHrs = Math.max(
                        1,
                        ...analytics.categoryUtilization.map((c) => c.scheduledHours)
                      );
                      const pct = Math.round((cat.scheduledHours / maxCatHrs) * 100);
                      return (
                        <div key={cat.category} className="analytics-meter-item">
                          <div className="analytics-meter-top">
                            <span>
                              <strong>{cat.category}</strong>{' '}
                              <span style={{ color: 'var(--ink-muted)', fontSize: '0.76rem' }}>
                                ({cat.facilityCount} spaces)
                              </span>
                            </span>
                            <span className="tabular" style={{ fontWeight: 600 }}>
                              {cat.scheduledHours}h · {cat.totalRequests} req
                            </span>
                          </div>
                          <div className="analytics-meter-track">
                            <div
                              className="analytics-meter-fill-blue"
                              style={{ width: `${cat.scheduledHours > 0 ? Math.max(6, pct) : 0}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>

              <article className="analytics-card">
                <div className="analytics-card-header">
                  <div>
                    <h2 className="analytics-card-title">Recent Administrative Activity</h2>
                    <p className="analytics-card-sub">
                      Latest recorded system &amp; approval audit events
                    </p>
                  </div>
                  <CheckCircle2 size={16} style={{ color: '#059669' }} aria-hidden="true" />
                </div>

                {analytics.auditLogs.length === 0 ? (
                  <div className="analytics-empty">
                    Audit entries will appear here as administrative actions are performed.
                  </div>
                ) : (
                  <div className="schedule-list" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    {analytics.auditLogs.slice(0, 10).map((log) => (
                      <div key={log.id} className="schedule-row">
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--ink-primary)' }}>
                            {log.action}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)' }}>
                            {log.details}
                          </div>
                          <div className="meta-line" style={{ fontSize: '0.74rem', marginTop: '0.15rem' }}>
                            <span>{log.actorEmail}</span>
                            <span aria-hidden="true">·</span>
                            <span>{log.actorRole}</span>
                            {log.createdAt && (
                              <>
                                <span aria-hidden="true">·</span>
                                <time dateTime={log.createdAt}>
                                  {String(log.createdAt).slice(0, 16).replace('T', ' ')}
                                </time>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </div>

            {/* Interactive Facility Performance Table + Drill-Down Inspector */}
            <section className="analytics-card" aria-label="Facility performance data table">
              <div className="analytics-card-header">
                <div>
                  <h2 className="analytics-card-title">Facility Performance &amp; Drill-Down</h2>
                  <p className="analytics-card-sub">
                    Click any facility row to inspect detailed status counts, operating hours, and schedule links
                  </p>
                </div>
                <span className="meta-line">
                  <Filter size={14} aria-hidden="true" />
                  <span>Showing {facilitySorted.length} facilities</span>
                </span>
              </div>

              {facilitySorted.length === 0 ? (
                <div className="analytics-empty">
                  No campus facilities match your search or category filters.
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Facility</th>
                        <th>Status</th>
                        <th>Capacity</th>
                        <th>Requests</th>
                        <th>Confirmed</th>
                        <th>Scheduled Hours</th>
                        <th>Open Issues</th>
                        <th style={{ minWidth: '150px' }}>Relative Volume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {facilitySorted.map((item) => {
                        const widthPct = Math.round((item.totalRequests / maxFacilityRequests) * 100);
                        const isSelected = selectedFacilityId === item.facilityId;
                        return (
                          <tr
                            key={item.facilityId}
                            className={`analytics-table-row-clickable ${isSelected ? 'selected' : ''}`}
                            onClick={() =>
                              setSelectedFacilityId((prev) =>
                                prev === item.facilityId ? null : item.facilityId
                              )
                            }
                          >
                            <td>
                              <div style={{ fontWeight: 600 }}>{item.name}</div>
                              <div className="meta-line">
                                <span className="tabular">{item.code}</span>
                                <span aria-hidden="true">·</span>
                                <span>{item.floor || item.building}</span>
                                <span aria-hidden="true">·</span>
                                <span>{item.category}</span>
                              </div>
                            </td>
                            <td>
                              <span
                                className={`status-text status-${item.status.toLowerCase().replace(/\s+/g, '-')}`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td className="tabular">
                              {item.capacity != null ? item.capacity : 'Unspecified'}
                            </td>
                            <td className="tabular">{item.totalRequests}</td>
                            <td className="tabular">{item.confirmedCount}</td>
                            <td className="tabular">{item.scheduledHours}h</td>
                            <td className="tabular">{item.openIssueCount}</td>
                            <td>
                              <div className="bar-track" aria-label={`${item.totalRequests} total requests`}>
                                <div
                                  className="bar-fill-coral"
                                  style={{ width: `${item.totalRequests > 0 ? Math.max(6, widthPct) : 0}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedFacility && (
                <aside className="analytics-drilldown-panel" aria-label="Selected facility drill-down">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <span className="section-kicker" style={{ marginBottom: '0.15rem', color: 'var(--accent-blue)' }}>
                        Facility Drill-Down · {selectedFacility.code}
                      </span>
                      <h3 style={{ fontSize: '1.15rem', color: 'var(--ink-primary)' }}>
                        {selectedFacility.name}
                      </h3>
                      <p style={{ fontSize: '0.82rem', color: 'var(--ink-secondary)', marginTop: '0.2rem' }}>
                        {selectedFacility.building}
                        {selectedFacility.floor ? ` · ${selectedFacility.floor}` : ''} ·{' '}
                        {selectedFacility.category} · Operating Hours{' '}
                        <span className="tabular">
                          {selectedFacility.openHour}–{selectedFacility.closeHour}
                        </span>{' '}
                        · Capacity{' '}
                        <span className="tabular">
                          {selectedFacility.capacity != null ? `${selectedFacility.capacity} seats` : 'Unspecified'}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-glass btn-sm"
                      onClick={() => setSelectedFacilityId(null)}
                    >
                      <X size={14} aria-hidden="true" />
                      <span>Close Drill-Down</span>
                    </button>
                  </div>

                  <dl className="analytics-drilldown-grid">
                    <div className="analytics-drilldown-stat">
                      <dt>Total Requests</dt>
                      <dd>{selectedFacility.totalRequests}</dd>
                    </div>
                    <div className="analytics-drilldown-stat">
                      <dt>Confirmed / Done</dt>
                      <dd>{selectedFacility.confirmedCount}</dd>
                    </div>
                    <div className="analytics-drilldown-stat">
                      <dt>Pending Review</dt>
                      <dd>{selectedFacility.pendingCount}</dd>
                    </div>
                    <div className="analytics-drilldown-stat">
                      <dt>Rejected / Cancelled</dt>
                      <dd>{selectedFacility.rejectedCount + selectedFacility.cancelledCount}</dd>
                    </div>
                    <div className="analytics-drilldown-stat">
                      <dt>Scheduled Hours</dt>
                      <dd>{selectedFacility.scheduledHours}h</dd>
                    </div>
                    <div className="analytics-drilldown-stat">
                      <dt>Open Issues</dt>
                      <dd>
                        {selectedFacility.openIssueCount}/{selectedFacility.issueCount}
                      </dd>
                    </div>
                  </dl>

                  <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                    <Link to={`/app/facilities/${selectedFacility.facilityId}`} className="btn btn-coral btn-sm">
                      Open Facility Details
                    </Link>
                    <Link to="/app/calendar" className="btn btn-glass btn-sm">
                      Inspect Facility Calendar
                    </Link>
                  </div>
                </aside>
              )}
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
