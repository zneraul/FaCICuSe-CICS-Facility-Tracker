import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CalendarPlus } from 'lucide-react';
import { AppShell } from '../components/AppShell.jsx';
import { apiRequest } from '../services/api.js';

const STATUS_TABS = ['All', 'Pending', 'Confirmed', 'Rejected', 'Cancelled'];

export function ReservationsPage() {
  const [reservations, setReservations] = useState([]);
  const [statusTab, setStatusTab] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const loadReservations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = statusTab !== 'All' ? `?status=${encodeURIComponent(statusTab)}` : '';
      const res = await apiRequest(`/reservations${qs}`);
      setReservations(res.reservations || []);
    } catch (err) {
      setError(err.message || 'Unable to load reservations.');
    } finally {
      setLoading(false);
    }
  }, [statusTab]);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  async function handleCancel(id) {
    setBusyId(id);
    setError('');
    setFeedback('');
    try {
      await apiRequest(`/reservations/${id}/cancel`, { method: 'PATCH' });
      setConfirmCancelId(null);
      setFeedback(`Reservation #${id} has been cancelled.`);
      await loadReservations();
    } catch (err) {
      setError(err.message || 'Unable to cancel reservation.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell
      title="My Reservations"
      primaryAction={
        <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
          <Link to="/app/calendar" className="btn btn-glass btn-sm">
            <CalendarDays size={15} aria-hidden="true" />
            <span>Open Calendar</span>
          </Link>
          <Link to="/app/facilities" className="btn btn-coral btn-sm">
            <CalendarPlus size={16} aria-hidden="true" />
            <span>New Booking</span>
          </Link>
        </div>
      }
    >
      <div style={{ overflowX: 'auto', paddingBottom: '0.2rem' }}>
        <div className="v10-tabs" role="tablist" aria-label="Reservation status filter">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={statusTab === tab}
              className={`v10-tab-btn ${statusTab === tab ? 'active' : ''}`}
              onClick={() => setStatusTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="alert-banner alert-error" role="alert">
          {error}
        </div>
      )}

      {feedback && (
        <div className="alert-banner alert-success" role="status">
          {feedback}
        </div>
      )}

      <section className="glass-panel" aria-label="Reservation history">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Loading reservations...</div>
        ) : reservations.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--ink-secondary)' }}>
              No reservations found under "{statusTab}".
            </p>
            <Link to="/app/facilities" className="btn btn-coral btn-sm" style={{ marginTop: '0.85rem' }}>
              Request a Facility
            </Link>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Facility</th>
                  <th>Date & Time</th>
                  <th>Attendees</th>
                  <th>Purpose & Notes</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((item) => {
                  const canCancel = item.status === 'Pending' || item.status === 'Confirmed';
                  return (
                    <tr key={item.id}>
                      <td className="tabular">#{item.id}</td>
                      <td>
                        <Link
                          to={`/app/facilities/${item.facilityId}`}
                          style={{ fontWeight: 600, color: 'var(--ink-primary)' }}
                        >
                          {item.facilityName}
                        </Link>
                        <div className="meta-line">
                          <span className="tabular">{item.facilityCode}</span>
                          <span aria-hidden="true">·</span>
                          <span>{item.facilityFloor || item.facilityBuilding}</span>
                        </div>
                      </td>
                      <td>
                        <div className="tabular" style={{ fontWeight: 600 }}>
                          {item.reservationDate}
                        </div>
                        <div className="tabular" style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
                          {item.startTime}–{item.endTime}
                        </div>
                      </td>
                      <td className="tabular">{item.attendeesCount}</td>
                      <td style={{ maxWidth: '280px' }}>
                        <div>{item.purpose}</div>
                        {item.academicBlock && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--accent-indigo)', fontWeight: 600, marginTop: '0.2rem' }}>
                            Block: <span className="tabular">{item.academicBlock}</span>
                          </div>
                        )}
                        {item.reviewNote && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '0.25rem' }}>
                            Note: {item.reviewNote}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          className={`status-text status-${item.status.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td>
                        {canCancel ? (
                          confirmCancelId === item.id ? (
                            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btn btn-danger-ghost btn-sm"
                                disabled={busyId === item.id}
                                onClick={() => handleCancel(item.id)}
                              >
                                {busyId === item.id ? 'Cancelling...' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-glass btn-sm"
                                onClick={() => setConfirmCancelId(null)}
                              >
                                Keep
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-danger-ghost btn-sm"
                              onClick={() => setConfirmCancelId(item.id)}
                            >
                              Cancel
                            </button>
                          )
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                            Closed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
