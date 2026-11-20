import React, { useCallback, useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
import { AppShell } from '../components/AppShell.jsx';
import { apiRequest } from '../services/api.js';

const ISSUE_CATEGORIES = ['AV Equipment', 'HVAC', 'Electrical', 'Furniture', 'Structural', 'Safety', 'Other'];
const ISSUE_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

export function IssuesPage() {
  const [facilities, setFacilities] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [facilityId, setFacilityId] = useState('');
  const [category, setCategory] = useState('AV Equipment');
  const [priority, setPriority] = useState('Medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [facRes, issueRes] = await Promise.all([
        apiRequest('/facilities'),
        apiRequest('/issues'),
      ]);
      const facList = facRes.facilities || [];
      setFacilities(facList);
      if (facList.length > 0) {
        setFacilityId((prev) => prev || String(facList[0].id));
      }
      setIssues(issueRes.issues || []);
    } catch (err) {
      setError(err.message || 'Unable to load maintenance data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) {
      setImageDataUrl('');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, or WebP).');
      return;
    }
    if (file.size > 900_000) {
      setError('Supporting photo must be smaller than 900 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      const res = await apiRequest('/issues', {
        method: 'POST',
        body: JSON.stringify({
          facilityId: Number(facilityId),
          category,
          priority,
          title,
          description,
          imageDataUrl: imageDataUrl || null,
        }),
      });
      setSuccess(`Maintenance report #${res.issue.id} submitted.`);
      setTitle('');
      setDescription('');
      setImageDataUrl('');
      await loadData();
    } catch (err) {
      setError(err.message || 'Unable to submit maintenance report.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="Maintenance Reporting">
      <div className="detail-split">
        {/* Submit Issue Form */}
        <section className="glass-panel" aria-label="Report a facility problem">
          <h2 style={{ fontSize: '1.2rem', marginBottom: '0.35rem' }}>
            Submit Facility Maintenance Report
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--ink-secondary)', marginBottom: '1rem' }}>
            Report equipment malfunctions, environmental issues, or structural wear directly to Campus Operations.
          </p>

          {error && (
            <div className="alert-banner alert-error" role="alert" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          {success && (
            <div className="alert-banner alert-success" role="status" style={{ marginBottom: '1rem' }}>
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
            <div className="field-group">
              <label htmlFor="issue-facility" className="field-label">
                Affected Facility
              </label>
              <select
                id="issue-facility"
                className="field-select"
                required
                value={facilityId}
                onChange={(e) => setFacilityId(e.target.value)}
              >
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code} — {f.name} ({f.floor})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-grid-2">
              <div className="field-group">
                <label htmlFor="issue-category" className="field-label">
                  Category
                </label>
                <select
                  id="issue-category"
                  className="field-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {ISSUE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="issue-priority" className="field-label">
                  Priority
                </label>
                <select
                  id="issue-priority"
                  className="field-select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  {ISSUE_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="issue-title" className="field-label">
                Issue Summary
              </label>
              <input
                id="issue-title"
                type="text"
                className="field-input"
                required
                minLength={4}
                maxLength={140}
                placeholder="e.g. Projector display flickering in Room 101"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label htmlFor="issue-desc" className="field-label">
                Detailed Description
              </label>
              <textarea
                id="issue-desc"
                className="field-textarea"
                required
                minLength={10}
                maxLength={2000}
                placeholder="Include exact seat row, equipment label, or observed behavior..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label htmlFor="issue-photo" className="field-label">
                Supporting Image (Optional)
              </label>
              <input
                id="issue-photo"
                type="file"
                accept="image/*"
                className="field-input"
                onChange={handleFileChange}
              />
              {imageDataUrl && (
                <img
                  src={imageDataUrl}
                  alt="Uploaded issue attachment preview"
                  style={{
                    marginTop: '0.5rem',
                    maxHeight: '140px',
                    width: 'auto',
                    borderRadius: '10px',
                    objectFit: 'cover',
                  }}
                />
              )}
            </div>

            <button type="submit" className="btn btn-coral" disabled={submitting}>
              <Wrench size={16} aria-hidden="true" />
              <span>{submitting ? 'Submitting Report...' : 'Submit Maintenance Report'}</span>
            </button>
          </form>
        </section>

        {/* Tracked Issues List */}
        <section className="glass-panel" aria-label="Tracked maintenance issues">
          <h2 style={{ fontSize: '1.2rem', marginBottom: '0.85rem' }}>
            Tracked Maintenance Issues
          </h2>

          {loading ? (
            <div style={{ padding: '1.5rem 0' }}>Loading reports...</div>
          ) : issues.length === 0 ? (
            <p style={{ color: 'var(--ink-secondary)', fontSize: '0.92rem' }}>
              You have not submitted any maintenance issues yet.
            </p>
          ) : (
            <div className="schedule-list">
              {issues.map((issue) => (
                <article key={issue.id} className="schedule-row" style={{ flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '0.75rem' }}>
                    <strong style={{ fontSize: '0.96rem' }}>{issue.title}</strong>
                    <span
                      className={`status-text status-${issue.status.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {issue.status}
                    </span>
                  </div>

                  <div className="meta-line">
                    <span className="tabular">#{issue.id}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {issue.facilityName}
                      {issue.facilityFloor ? ` (${issue.facilityFloor})` : ''}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{issue.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>Priority: {issue.priority}</span>
                  </div>

                  <p style={{ fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
                    {issue.description}
                  </p>

                  {issue.imageDataUrl && (
                    <img
                      src={issue.imageDataUrl}
                      alt={`Attachment for ${issue.title}`}
                      style={{
                        maxHeight: '140px',
                        borderRadius: '10px',
                        objectFit: 'cover',
                        marginTop: '0.25rem',
                      }}
                    />
                  )}

                  {(issue.assignedTo || issue.actionTaken) && (
                    <div
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '10px',
                        background: 'var(--bg-tint-blue)',
                        border: '1px solid #bfdbfe',
                        fontSize: '0.83rem',
                        color: 'var(--ink-primary)',
                      }}
                    >
                      {issue.assignedTo && (
                        <div>
                          <strong>Assigned Team:</strong> {issue.assignedTo}
                        </div>
                      )}
                      {issue.actionTaken && (
                        <div>
                          <strong>Action Taken:</strong> {issue.actionTaken}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
