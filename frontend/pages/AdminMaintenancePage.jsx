import React, { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell.jsx';
import { apiRequest } from '../services/api.js';

const ISSUE_TABS = ['All', 'Open', 'In Progress', 'Resolved', 'Closed'];

export function AdminMaintenancePage() {
  const [issues, setIssues] = useState([]);
  const [tab, setTab] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [edits, setEdits] = useState({});
  const [busyId, setBusyId] = useState(null);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = tab !== 'All' ? `?status=${encodeURIComponent(tab)}` : '';
      const res = await apiRequest(`/issues${qs}`);
      setIssues(res.issues || []);
    } catch (err) {
      setError(err.message || 'Unable to load maintenance tickets.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  function getEditState(issue) {
    return (
      edits[issue.id] || {
        status: issue.status,
        assignedTo: issue.assignedTo || '',
        actionTaken: issue.actionTaken || '',
      }
    );
  }

  function updateField(id, issue, field, val) {
    const current = getEditState(issue);
    setEdits((prev) => ({
      ...prev,
      [id]: {
        ...current,
        [field]: val,
      },
    }));
  }

  async function handleSave(issue) {
    const payload = getEditState(issue);
    setBusyId(issue.id);
    setError('');
    setFeedback('');
    try {
      await apiRequest(`/admin/issues/${issue.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setFeedback(`Updated ticket #${issue.id} to ${payload.status}.`);
      await loadIssues();
    } catch (err) {
      setError(err.message || 'Unable to update maintenance ticket.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell title="Maintenance Triage">
      <div style={{ overflowX: 'auto', paddingBottom: '0.2rem' }}>
        <div className="v10-tabs" role="tablist" aria-label="Filter maintenance issues">
          {ISSUE_TABS.map((t) => (
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {loading ? (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
            Loading maintenance tickets...
          </div>
        ) : issues.length === 0 ? (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--ink-secondary)' }}>
            No maintenance tickets found under "{tab}".
          </div>
        ) : (
          issues.map((issue) => {
            const state = getEditState(issue);
            return (
              <article key={issue.id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <div className="meta-line">
                      <span className="tabular">#{issue.id}</span>
                      <span aria-hidden="true">·</span>
                      <span>{issue.facilityName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{issue.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>Priority: {issue.priority}</span>
                      <span aria-hidden="true">·</span>
                      <span>Reported by {issue.reporterName}</span>
                    </div>
                    <h2 style={{ fontSize: '1.15rem', marginTop: '0.25rem' }}>{issue.title}</h2>
                  </div>

                  <span
                    className={`status-text status-${issue.status.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {issue.status}
                  </span>
                </div>

                <p style={{ fontSize: '0.92rem', color: 'var(--ink-secondary)' }}>
                  {issue.description}
                </p>

                {issue.imageDataUrl && (
                  <img
                    src={issue.imageDataUrl}
                    alt={`Attachment for ${issue.title}`}
                    style={{ maxHeight: '160px', width: 'fit-content', borderRadius: '10px', objectFit: 'cover' }}
                  />
                )}

                <div className="triage-form-grid">
                  <div className="field-group">
                    <label htmlFor={`st-${issue.id}`} className="field-label">Status</label>
                    <select
                      id={`st-${issue.id}`}
                      className="field-select"
                      value={state.status}
                      onChange={(e) => updateField(issue.id, issue, 'status', e.target.value)}
                    >
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>

                  <div className="field-group">
                    <label htmlFor={`as-${issue.id}`} className="field-label">Assigned Team</label>
                    <input
                      id={`as-${issue.id}`}
                      className="field-input"
                      placeholder="e.g. Campus Electrical"
                      value={state.assignedTo}
                      onChange={(e) => updateField(issue.id, issue, 'assignedTo', e.target.value)}
                    />
                  </div>

                  <div className="field-group">
                    <label htmlFor={`ac-${issue.id}`} className="field-label">Action Taken</label>
                    <input
                      id={`ac-${issue.id}`}
                      className="field-input"
                      placeholder="Record inspection or repair notes..."
                      value={state.actionTaken}
                      onChange={(e) => updateField(issue.id, issue, 'actionTaken', e.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-coral btn-sm"
                    disabled={busyId === issue.id}
                    onClick={() => handleSave(issue)}
                  >
                    {busyId === issue.id ? 'Saving...' : 'Update Ticket'}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
