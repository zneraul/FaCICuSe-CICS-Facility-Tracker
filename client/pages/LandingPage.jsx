import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BellRing,
  Building2,
  GraduationCap,
  CalendarCheck2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Search,
  ShieldCheck,
  UserRoundCheck,
  Wrench,
} from 'lucide-react';
import { PublicLayout } from '../components/PublicLayout.jsx';
import { FacilityImage } from '../components/FacilityImage.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAuthModal } from '../context/AuthModalContext.jsx';
import { apiRequest } from '../services/api.js';

const CATEGORIES = ['All', 'Learning', 'Administrative', 'Support'];
const FLOORS = ['All Floors', 'First Floor', 'Second Floor', 'Third Floor', 'Fourth Floor', 'Fifth Floor'];

const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Discover CICS Building spaces',
    description:
      'Filter CICS classrooms (101–506), Computer Laboratories 1–6, Physics/Tech/IT labs, and administrative or support rooms by floor and category.',
    icon: Compass,
  },
  {
    step: '02',
    title: 'Inspect live booking windows',
    description:
      'Pick any upcoming date to review active Pending and Confirmed time blocks alongside posted CICS facility operating hours.',
    icon: Clock,
  },
  {
    step: '03',
    title: 'Submit conflict-checked request',
    description:
      'Provide your time range, headcount, optional BSIT academic block (e.g. IT-3106), and purpose. Server-side validation checks hours and overlaps.',
    icon: CalendarCheck2,
  },
  {
    step: '04',
    title: 'Coordinate approvals & alerts',
    description:
      'Facilities administrators review requests with recorded notes, triggering instant workspace notifications for students and faculty.',
    icon: BellRing,
  },
];

const FAQ_ITEMS = [
  {
    q: 'Can students and faculty check room availability before signing in?',
    a: 'Yes. The public directory and live availability checker display floor locations, CICS room categories, operational statuses, and anonymized Pending or Confirmed blocks for any date.',
  },
  {
    q: 'How are double bookings and overlapping reservations prevented?',
    a: 'Every reservation request is validated inside an atomic server-side transaction against active Pending and Confirmed bookings for that facility and date, rejecting conflicts immediately.',
  },
  {
    q: 'How are maintenance issues reported and resolved?',
    a: 'Signed-in users file structured tickets linked to a specific CICS room with severity and optional photos. Administrators triage tickets from Open to Resolved with action notes.',
  },
  {
    q: 'Who can view utilization analytics and administrative controls?',
    a: 'Utilization analytics, facility status switches, and user role governance are strictly enforced for System Administrators only on both the server API and workspace navigation.',
  },
];

function getDefaultDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function LandingPage() {
  const { user } = useAuth();
  const { openSignInModal } = useAuthModal();
  const [facilities, setFacilities] = useState([]);
  const [allFacilities, setAllFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [floor, setFloor] = useState('All Floors');
  const [search, setSearch] = useState('');
  const [openFaq, setOpenFaq] = useState(0);

  // Live availability preview widget state (Section 5)
  const [previewFacilityId, setPreviewFacilityId] = useState('');
  const [previewDate, setPreviewDate] = useState(getDefaultDate);
  const [previewDetail, setPreviewDetail] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewRefresh, setPreviewRefresh] = useState(0);

  // Load unfiltered directory once for the live availability selector & stats
  useEffect(() => {
    let active = true;
    apiRequest('/public/facilities')
      .then((res) => {
        if (!active) return;
        const list = res.facilities || [];
        setAllFacilities(list);
        const firstReservable = list.find((f) => f.isReservable !== false) || list[0];
        if (firstReservable) {
          setPreviewFacilityId((prev) => prev || String(firstReservable.id));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Load filtered campus facilities grid (Section 3)
  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== 'All') params.set('category', category);
    if (floor !== 'All Floors') params.set('floor', floor);
    if (search.trim()) params.set('search', search.trim());

    apiRequest(`/public/facilities?${params.toString()}`)
      .then((res) => {
        if (active) setFacilities(res.facilities || []);
      })
      .catch(() => {
        if (active) setFacilities([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [category, floor, search]);

  // Fetch live schedule windows for the selected preview facility & date (Section 5)
  useEffect(() => {
    if (!previewFacilityId || !previewDate) return;
    let active = true;
    setPreviewLoading(true);
    apiRequest(`/public/facilities/${previewFacilityId}?date=${encodeURIComponent(previewDate)}`)
      .then((res) => {
        if (active) setPreviewDetail(res);
      })
      .catch(() => {
        if (active) setPreviewDetail(null);
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [previewFacilityId, previewDate, previewRefresh]);

  const reservableActiveCount = allFacilities.filter(
    (f) => f.isReservable !== false && f.status === 'Available'
  ).length;
  const floorCount = new Set(allFacilities.map((f) => f.floor).filter(Boolean)).size || 5;
  const previewFacilities = allFacilities.filter((f) => f.isReservable !== false);

  return (
    <PublicLayout>
      {/* 1. Hero Section */}
      <section id="home" className="landing-hero" aria-labelledby="hero-heading">
        <div className="glass-panel landing-hero-copy">
          <div className="meta-line">
            <span className="brand-logo-badge" style={{ width: '26px', height: '26px', borderRadius: '7px' }}>
              <img
                src="/assets/images/facicuse-logo.jpg"
                alt=""
                aria-hidden="true"
                style={{ width: '20px', height: '20px', objectFit: 'contain' }}
              />
            </span>
            <span>Batangas State University – Alangilan</span>
            <span aria-hidden="true">·</span>
            <span>CICS</span>
          </div>

          <h1 id="hero-heading" className="landing-headline">
            Coordinate every{' '}
            <span className="landing-headline-gradient">classroom, computer lab, and CICS space</span>{' '}
            in one place.
          </h1>

          <p className="landing-subhead">
            Real-time monitoring and reservation scheduling for the 5-floor College of Informatics and
            Computing Sciences (CICS) Building—keeping room allocations transparent and conflict-free.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', marginTop: '0.35rem' }}>
            <Link to="/facilities" className="btn btn-coral">
              <span>Browse All 38 Spaces</span>
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link to="/timetable" className="btn btn-glass">View Class Timetable</Link>
            {user ? (
              <Link to="/app/dashboard" className="btn btn-glass">
                Open Workspace
              </Link>
            ) : (
              <button
                type="button"
                className="btn btn-glass"
                onClick={() => openSignInModal()}
              >
                Sign In to Workspace
              </button>
            )}
          </div>

          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: '0.85rem',
              margin: '0.75rem 0 0',
              paddingTop: '1rem',
              borderTop: '1px solid var(--glass-border-subtle)',
            }}
          >
            <div>
              <dd className="tabular" style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
                {38}
              </dd>
              <dt style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>CICS spaces</dt>
            </div>
            <div>
              <dd className="tabular" style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: 'var(--accent-purple)' }}>
                {reservableActiveCount}
              </dd>
              <dt style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>Reservable rooms</dt>
            </div>
            <div>
              <dd className="tabular" style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: 'var(--ink-primary)' }}>
                {floorCount}
              </dd>
              <dt style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>Building floors</dt>
            </div>
          </dl>
        </div>

        <figure className="landing-hero-media" style={{ margin: 0 }}>
          <img
            src="/assets/images/facilities/Building/Wider.jpeg"
            alt="Batangas State University Alangilan CICS building exterior"
            fetchPriority="high"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={(event) => {
              const image = event.currentTarget;
              if (image.dataset.fallbackApplied) {
                image.style.display = 'none';
                return;
              }
              image.dataset.fallbackApplied = 'true';
              image.src = '/assets/images/cics-building.jpg';
            }}
          />
          <figcaption className="landing-hero-caption">
            <div style={{ fontWeight: 600, fontSize: '0.96rem' }}>
              College of Informatics and Computing Sciences (CICS)
            </div>
            <div style={{ fontSize: '0.82rem', color: 'rgba(238,242,255,0.86)', marginTop: '0.2rem' }}>
              5-Floor College Building · 1 Building · 5 Floors · 38 Facilities
            </div>
          </figcaption>
        </figure>
      </section>

      {/* 3. Campus Facilities */}
      <section id="facilities" className="landing-section" aria-labelledby="discovery-heading">
        <div className="section-header-row">
          <div>
            <span className="section-kicker">CICS Building Directory</span>
            <h2 id="discovery-heading" className="section-title">
              Explore CICS Classrooms, Labs &amp; Offices
            </h2>
            <p style={{ color: 'var(--ink-secondary)', marginTop: '0.35rem' }}>
              Filter rooms across Floors 1–5 by category, floor, or reservability before signing in.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', maxWidth: '100%' }}>
            <label htmlFor="landing-facility-search" className="sr-only">
              Search CICS facilities
            </label>
            <div style={{ position: 'relative', width: 'min(260px, 100%)' }}>
              <Search
                size={16}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: '0.8rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--ink-muted)',
                }}
              />
              <input
                id="landing-facility-search"
                type="search"
                className="field-input"
                style={{ paddingLeft: '2.35rem' }}
                placeholder="Search CICS rooms or codes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <label htmlFor="landing-floor-select" className="sr-only">
              Filter by CICS floor
            </label>
            <select
              id="landing-floor-select"
              className="field-select"
              style={{ width: 'auto', minWidth: '145px' }}
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
            >
              {FLOORS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <Link to="/facilities" className="btn btn-glass btn-sm">
              Full Directory
            </Link>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          <div className="v10-tabs" role="tablist" aria-label="Facility categories">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={category === cat}
                className={`v10-tab-btn ${category === cat ? 'active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '2.5rem' }}>
            Loading CICS Building facilities...
          </div>
        ) : facilities.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '2.5rem' }}>
            <p style={{ color: 'var(--ink-secondary)' }}>
              No facilities match your current filter.
            </p>
            <button
              type="button"
              className="btn btn-glass btn-sm"
              style={{ marginTop: '0.85rem' }}
              onClick={() => {
                setCategory('All');
                setFloor('All Floors');
                setSearch('');
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="facilities-grid">
            {facilities.slice(0, 6).map((facility) => (
              <article key={facility.id} className="facility-card">
                <div className="facility-media-wrap">
                  <FacilityImage src={facility.imageUrl} alt={facility.name} />
                </div>
                <div className="facility-card-body">
                  <div className="meta-line">
                    <span className="tabular">{facility.code}</span>
                    <span aria-hidden="true">·</span>
                    <span>{facility.category}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`status-text status-${facility.status.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {facility.status}
                    </span>
                  </div>

                  <h3 className="facility-card-title">{facility.name}</h3>
                  <p className="facility-card-desc">{facility.description}</p>

                  <div className="meta-line" style={{ marginTop: '0.2rem' }}>
                    <span>{facility.building}</span>
                    <span aria-hidden="true">·</span>
                    <span>{facility.floor}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular">
                      {facility.capacity != null
                        ? `Cap. ${facility.capacity}`
                        : facility.isReservable === false
                          ? 'Non-reservable'
                          : 'Cap. Unspecified'}
                    </span>
                  </div>

                  <div className="facility-card-footer">
                    <time className="tabular" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                      {facility.openHour}–{facility.closeHour}
                    </time>
                    <Link to={`/facilities/${facility.id}`} className="btn btn-glass btn-sm">
                      View Details
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 5. Facility Reservations (Interactive Availability Explorer + Photo Collage) */}
      <section id="reservations" className="landing-section" aria-labelledby="reservations-demo-heading">
        <div className="reservation-demo-split">
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div>
              <span className="section-kicker">Live Schedule Check</span>
              <h2 id="reservations-demo-heading" className="section-title">
                Check Room Availability Before Requesting
              </h2>
              <p style={{ color: 'var(--ink-secondary)', marginTop: '0.45rem', fontSize: '0.94rem' }}>
                Select a reservable CICS room and date to inspect active Pending or Confirmed booking blocks.
              </p>
            </div>

            <div className="form-grid-2">
              <div className="field-group">
                <label htmlFor="preview-facility-select" className="field-label">
                  CICS Facility
                </label>
                <select
                  id="preview-facility-select"
                  className="field-select"
                  value={previewFacilityId}
                  onChange={(e) => setPreviewFacilityId(e.target.value)}
                >
                  {(previewFacilities.length > 0 ? previewFacilities : allFacilities).map((f) => (
                    <option key={f.id} value={String(f.id)}>
                      {f.code} · {f.name} ({f.floor})
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="preview-date-input" className="field-label">
                  Target Date
                </label>
                <input
                  id="preview-date-input"
                  type="date"
                  className="field-input"
                  value={previewDate}
                  onChange={(e) => setPreviewDate(e.target.value)}
                />
              </div>
            </div>

            <div className="preview-form-actions" style={{ justifyContent: 'flex-start' }}>
              <button
                type="button"
                className="btn btn-glass btn-sm"
                onClick={() => setPreviewRefresh((value) => value + 1)}
                disabled={!previewFacilityId || !previewDate || previewLoading}
              >
                {previewLoading ? 'Checking…' : 'Check Schedule'}
              </button>
            </div>

            <div className="glass-panel-subtle" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {previewLoading ? (
                <p style={{ fontSize: '0.9rem', color: 'var(--ink-muted)' }}>
                  Checking recorded booking windows...
                </p>
              ) : previewDetail?.facility ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <strong style={{ fontSize: '0.98rem' }}>{previewDetail.facility.name}</strong>
                      <div className="meta-line">
                        <span>{previewDetail.facility.building}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular">
                          Hours {previewDetail.facility.openHour}–{previewDetail.facility.closeHour}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`status-text status-${previewDetail.facility.status.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {previewDetail.facility.status}
                    </span>
                  </div>

                  {previewDetail.schedule && previewDetail.schedule.length > 0 ? (
                    <div className="schedule-list">
                      {previewDetail.schedule.map((slot) => (
                        <div key={slot.id} className="schedule-row" style={{ padding: '0.55rem 0' }}>
                          <span className="tabular" style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                            {slot.startTime} – {slot.endTime}
                          </span>
                          <span
                            className={`status-text status-${slot.status.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            {slot.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
                      No active reservations recorded for <span className="tabular">{previewDate}</span>.
                      All hours between{' '}
                      <span className="tabular">
                        {previewDetail.facility.openHour}–{previewDetail.facility.closeHour}
                      </span>{' '}
                      are currently open.
                    </p>
                  )}
                </>
              ) : (
                <p style={{ fontSize: '0.88rem', color: 'var(--ink-muted)' }}>
                  Select a campus facility to inspect its schedule.
                </p>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: 'auto' }}>
              {previewFacilityId && (
                <Link to={`/facilities/${previewFacilityId}`} className="btn btn-coral btn-sm">
                  <span>Open Room &amp; Book</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              )}
              {user ? (
                <Link to="/app/calendar" className="btn btn-glass btn-sm">
                  Open Calendar &amp; Request
                </Link>
              ) : (
                <button
                  type="button"
                  className="btn btn-glass btn-sm"
                  onClick={() => openSignInModal({ returnTo: '/app/calendar' })}
                >
                  Sign In to Submit Request
                </button>
              )}
            </div>
          </div>

          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div>
              <span className="section-kicker">Booking Lifecycle</span>
              <h3 className="section-title" style={{ fontSize: '1.35rem' }}>
                Three-Step Conflict-Free Coordination
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.25rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <span className="step-number">01</span>
                <div>
                  <strong style={{ fontSize: '0.92rem', color: 'var(--ink-primary)' }}>Pick an Open Window</strong>
                  <p style={{ fontSize: '0.86rem', color: 'var(--ink-secondary)', marginTop: '0.15rem' }}>
                    Verify posted CICS hours and avoid existing Pending or Confirmed time blocks.
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <span className="step-number">02</span>
                <div>
                  <strong style={{ fontSize: '0.92rem', color: 'var(--ink-primary)' }}>Submit Request with Optional Block Tag</strong>
                  <p style={{ fontSize: '0.86rem', color: 'var(--ink-secondary)', marginTop: '0.15rem' }}>
                    Include purpose, headcount, and optional BSIT section code (e.g., IT-3106).
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <span className="step-number">03</span>
                <div>
                  <strong style={{ fontSize: '0.92rem', color: 'var(--ink-primary)' }}>Track Decision &amp; Room Readiness</strong>
                  <p style={{ fontSize: '0.86rem', color: 'var(--ink-secondary)', marginTop: '0.15rem' }}>
                    Receive approval alerts and report room or equipment defects if repairs are needed.
                  </p>
                </div>
              </div>
            </div>
            <aside className="alert-banner alert-info" aria-label="Scheduling accuracy policy">
              <p style={{ fontSize: '0.86rem', color: 'var(--ink-secondary)' }}>
                Scheduled booking hours reflect confirmed reservations only and never infer unverified physical occupancy.
              </p>
            </aside>
          </div>
        </div>
      </section>

      {/* 4. How It Works & Campus Roles */}
      <section id="about" className="landing-section" aria-labelledby="roles-heading">
        <div className="section-header-row">
          <div>
            <span className="section-kicker">How It Works &amp; Access Roles</span>
            <h2 id="roles-heading" className="section-title">
              Focused Workspaces for Students, Faculty &amp; Administrators
            </h2>
            <p style={{ color: 'var(--ink-secondary)', marginTop: '0.35rem' }}>
              Each role accesses only the booking, maintenance, or governance tools it needs.
            </p>
          </div>
          <Link to="/facilities" className="btn btn-glass btn-sm">Browse All Spaces</Link>
        </div>
        <div className="roles-grid">
          <article className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div className="role-card-header">
              <span className="role-icon-box" aria-hidden="true"><GraduationCap size={20} /></span>
              <div><h3 style={{ fontSize: '1.08rem', fontWeight: 700, color: 'var(--ink-primary)' }}>Students</h3><div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>Academic study &amp; project rooms</div></div>
            </div>
            <ul className="bullets-clean">
              <li>Browse CICS rooms across Floors 1–5 and check open hours before signing in.</li>
              <li>Request Learning classrooms (101–506) with optional BSIT block tags (e.g., IT-3106).</li>
              <li>Report classroom or restroom maintenance issues directly to facilities staff.</li>
            </ul>
          </article>
          <article className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div className="role-card-header">
              <span className="role-icon-box" aria-hidden="true"><UserRoundCheck size={20} /></span>
              <div><h3 style={{ fontSize: '1.08rem', fontWeight: 700, color: 'var(--ink-primary)' }}>Professors</h3><div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>Computer labs &amp; instructional rooms</div></div>
            </div>
            <ul className="bullets-clean">
              <li>Reserve Computer Labs 1–6, SMART Classroom, and Physics/Tech/IT laboratories.</li>
              <li>Verify open slots ahead of class sessions and cancel unused bookings cleanly.</li>
              <li>Escalate projector, workstation, or HVAC issues with severity tracking.</li>
            </ul>
          </article>
          <article className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div className="role-card-header">
              <span className="role-icon-box" aria-hidden="true"><ShieldCheck size={20} /></span>
              <div><h3 style={{ fontSize: '1.08rem', fontWeight: 700, color: 'var(--ink-primary)' }}>Administrators</h3><div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>Approvals, repairs &amp; analytics</div></div>
            </div>
            <ul className="bullets-clean">
              <li>Approve or reject pending bookings with audit-logged administrative notes.</li>
              <li>Triage maintenance tickets, switch room statuses, and manage user roles.</li>
              <li>Review admin-only CICS utilization charts derived strictly from recorded bookings.</li>
            </ul>
          </article>
        </div>
      </section>

      {/* 6. Frequently Asked Questions */}
      <section id="faq" className="landing-section" aria-labelledby="faq-heading">
        <div className="section-header-row">
          <div>
            <span className="section-kicker">Questions &amp; Policy</span>
            <h2 id="faq-heading" className="section-title">
              Frequently Asked Questions
            </h2>
          </div>
        </div>

        <div className="faq-list">
          {FAQ_ITEMS.map((item, idx) => {
            const expanded = openFaq === idx;
            return (
              <div key={item.q} className="faq-item">
                <button
                  type="button"
                  className="faq-trigger"
                  aria-expanded={expanded}
                  onClick={() => setOpenFaq(expanded ? -1 : idx)}
                >
                  <span>{item.q}</span>
                  {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {expanded && <div className="faq-answer">{item.a}</div>}
              </div>
            );
          })}
        </div>
      </section>

      {/* 7. Final Call to Action */}
      <section className="landing-section" aria-label="Get started">
        <div className="cta-glass-banner">
          <div style={{ maxWidth: '58ch' }}>
            <div className="meta-line" style={{ color: 'rgba(238,242,255,0.88)', marginBottom: '0.45rem' }}>
              <span>Ready to coordinate campus spaces?</span>
            </div>
            <h2 style={{ fontSize: 'clamp(1.65rem, 2.8vw, 2.25rem)', color: '#ffffff' }}>
              Ready to check or reserve a CICS Building space?
            </h2>
            <p style={{ color: 'rgba(240,242,255,0.9)', marginTop: '0.55rem', fontSize: '0.98rem' }}>
              Inspect room schedules immediately as a visitor, or sign in to submit reservations and maintenance reports.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem' }}>
            <Link to="/facilities" className="btn btn-on-coral">
              <span>Explore All 38 Spaces</span>
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link to="/timetable" className="btn btn-glass btn-sm">
              <span>View Class Timetable</span>
            </Link>
            {user ? (
              <Link
                to="/app/dashboard"
                className="btn"
                style={{
                  background: 'rgba(20, 17, 46, 0.34)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.38)',
                }}
              >
                Open Workspace
              </Link>
            ) : (
              <button
                type="button"
                className="btn"
                onClick={() => openSignInModal()}
                style={{
                  background: 'rgba(20, 17, 46, 0.34)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.38)',
                }}
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
