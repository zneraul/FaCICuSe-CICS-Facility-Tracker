import React, { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell.jsx';
import { apiRequest } from '../services/api.js';

const TABS = ['All', 'Pending', 'Confirmed', 'Rejected', 'Cancelled', 'Completed'];

export function AdminReservationsPage() {
  const [reservations, setReservations] = useState([]);
  const [tab, setTab] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [notes, setNotes] = useState({});
  const [openNoteId, setOpenNoteId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const loadReservations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = tab !== 'All' ? `?status=${encodeURIComponent(tab)}` : '';
      const res = await apiRequest(`/admin/reservations${qs}`);
      setReservations(res.reservations || []);
    } catch (err) {
      setError(err.message || 'Unable to load reservation requests.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  async function handleReview(id, nextStatus) {
    setBusyId(id);
    setError('');
    setFeedback('');
    try {
      await apiRequest(`/admin/reservations/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
          reviewNote: notes[id] || '',
        }),
      });
      setFeedback(`Reservation #${id} updated to ${nextStatus}.`);
      setOpenNoteId(null);
      await loadReservations();
    } catch (err) {
      setError(err.message || 'Could not update reservation status.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell title="Review Reservation Requests">
      <div style={{ overflowX: 'auto', paddingBottom: '0.2rem' }}>
        <div className="v10-tabs" role="tablist" aria-label="Filter reservation requests">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`v10-tab-btn ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
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

      <section className="glass-panel" aria-label="Campus reservation queue">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Loading reservation queue...</div>
        ) : reservations.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--ink-secondary)' }}>
            No reservations found for "{tab}".
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Requester</th>
                  <th>Facility</th>
                  <th>Schedule</th>
                  <th>Purpose</th>
                  <th>Status</th>
                  <th>Review Action</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => {
                  const noteExpanded = openNoteId === r.id || Boolean(notes[r.id]);
                  return (
                  <tr key={r.id}>
                    <td className="tabular">#{r.id}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.userFullName}</div>
                      <div className="meta-line">
                        <span>{r.userRole}</span>
                        <span aria-hidden="true">·</span>
                        <span>{r.userEmail}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.facilityName}</div>
                      <div className="tabular" style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                        {r.facilityCode}
                        {r.facilityFloor ? ` · ${r.facilityFloor}` : ''} · {r.attendeesCount} attendees
                      </div>
                    </td>
                    <td>
                      <div className="tabular" style={{ fontWeight: 600 }}>{r.reservationDate}</div>
                      <div className="tabular" style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
                        {r.startTime}–{r.endTime}
                      </div>
                    </td>
                    <td style={{ maxWidth: '240px' }}>
                      <div>{r.purpose}</div>
                      {r.academicBlock && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--accent-indigo)', fontWeight: 600, marginTop: '0.2rem' }}>
                          Block: <span className="tabular">{r.academicBlock}</span>
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        className={`status-text status-${r.status.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td style={{ minWidth: '200px' }}>
                      {r.status === 'Pending' || r.status === 'Confirmed' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {r.status === 'Pending' && (
                              <button
                                type="button"
                                className="btn btn-coral btn-sm"
                                disabled={busyId === r.id}
                                onClick={() => handleReview(r.id, 'Confirmed')}
                              >
                                Approve
                              </button>
                            )}
                            {r.status === 'Confirmed' && (
                              <button
                                type="button"
                                className="btn btn-glass btn-sm"
                                disabled={busyId === r.id}
                                onClick={() => handleReview(r.id, 'Completed')}
                              >
                                Complete
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-danger-ghost btn-sm"
                              disabled={busyId === r.id}
                              onClick={() => handleReview(r.id, 'Rejected')}
                            >
                              Reject
                            </button>
                            {!noteExpanded && (
                              <button
                                type="button"
                                className="btn btn-glass btn-sm"
                                onClick={() => setOpenNoteId(r.id)}
                              >
                                + Note
                              </button>
                            )}
                          </div>
                          {noteExpanded && (
                            <input
                              type="text"
                              className="field-input"
                              style={{ padding: '0.4rem 0.65rem', fontSize: '0.82rem', minHeight: '34px' }}
                              placeholder="Optional review note..."
                              aria-label={`Review note for reservation ${r.id}`}
                              value={notes[r.id] ?? r.reviewNote ?? ''}
                              onChange={(e) =>
                                setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))
                              }
                            />
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
                          {r.reviewNote || 'No further action'}
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
