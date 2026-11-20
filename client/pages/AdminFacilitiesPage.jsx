import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { AppShell } from '../components/AppShell.jsx';
import { apiRequest } from '../services/api.js';
import {
  DEFAULT_FACILITY_MEDIA,
  FACILITY_MEDIA_PRESETS,
} from '../../server/domain/facilityMedia.js';

const CICS_FLOORS = ['First Floor', 'Second Floor', 'Third Floor', 'Fourth Floor', 'Fifth Floor'];

const EMPTY_FORM = {
  code: '',
  name: '',
  category: 'Learning',
  building: 'CICS Building',
  floor: 'First Floor',
  capacity: '',
  description: '',
  amenities: '',
  status: 'Available',
  allowedRoles: 'student,professor,admin',
  openHour: '07:00',
  closeHour: '21:00',
  isReservable: true,
  imageUrl: DEFAULT_FACILITY_MEDIA.classroom,
};

export function AdminFacilitiesPage() {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [search, setSearch] = useState('');
  const [floorFilter, setFloorFilter] = useState('All Floors');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadFacilities = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest('/facilities');
      setFacilities(res.facilities || []);
    } catch (err) {
      setError(err.message || 'Unable to load facilities.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  const filteredFacilities = useMemo(() => {
    return facilities.filter((f) => {
      if (floorFilter !== 'All Floors' && f.floor !== floorFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          String(f.name || '').toLowerCase().includes(q) ||
          String(f.code || '').toLowerCase().includes(q) ||
          String(f.category || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [facilities, floorFilter, search]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(facility) {
    setEditingId(facility.id);
    setForm({
      code: facility.code,
      name: facility.name,
      category: facility.category,
      building: facility.building,
      floor: facility.floor,
      capacity: facility.capacity != null ? String(facility.capacity) : '',
      description: facility.description,
      amenities: (facility.amenities || []).join(', '),
      status: facility.status,
      allowedRoles: (facility.allowedRoles || []).join(','),
      openHour: facility.openHour,
      closeHour: facility.closeHour,
      isReservable: facility.isReservable !== false,
      imageUrl: facility.imageUrl,
    });
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setFeedback('');
    try {
      const payload = {
        ...form,
        capacity: form.capacity === '' || form.capacity == null ? null : Number(form.capacity),
        isReservable: Boolean(form.isReservable),
      };
      if (editingId) {
        await apiRequest(`/admin/facilities/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setFeedback(`Updated facility ${form.code}.`);
      } else {
        await apiRequest('/admin/facilities', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback(`Created new facility ${form.code}.`);
      }
      setModalOpen(false);
      await loadFacilities();
    } catch (err) {
      setError(err.message || 'Failed to save facility.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(facility) {
    setError('');
    setFeedback('');
    try {
      await apiRequest(`/admin/facilities/${facility.id}`, { method: 'DELETE' });
      setFeedback(`Archived facility ${facility.code}.`);
      await loadFacilities();
    } catch (err) {
      setError(err.message || 'Unable to archive facility.');
    }
  }

  return (
    <AppShell
      title="Manage Facilities"
      primaryAction={
        <button type="button" className="btn btn-coral btn-sm" onClick={openCreate}>
          <Plus size={16} aria-hidden="true" />
          <span>Add Facility</span>
        </button>
      }
    >
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

      <section className="glass-panel" aria-label="Facility inventory">
        <div className="form-grid-2" style={{ marginBottom: '1rem', alignItems: 'end' }}>
          <div className="field-group">
            <label htmlFor="admin-fac-search" className="field-label">
              Search Facilities ({filteredFacilities.length} of {facilities.length})
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
                id="admin-fac-search"
                type="search"
                className="field-input"
                style={{ paddingLeft: '2.2rem' }}
                placeholder="Search room name, code, or category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="field-group">
            <label htmlFor="admin-fac-floor" className="field-label">
              Building Floor
            </label>
            <select
              id="admin-fac-floor"
              className="field-select"
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
            >
              <option value="All Floors">All 5 Floors</option>
              {CICS_FLOORS.map((fl) => (
                <option key={fl} value={fl}>
                  {fl}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Loading facility inventory...</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Facility</th>
                  <th>Location</th>
                  <th>Capacity</th>
                  <th>Hours</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFacilities.map((f) => (
                  <tr key={f.id}>
                    <td className="tabular" style={{ fontWeight: 600 }}>
                      {f.code}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{f.name}</div>
                      <div className="meta-line">
                        <span>{f.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{f.isReservable === false ? 'Non-reservable' : 'Reservable'}</span>
                        <span aria-hidden="true">·</span>
                        <span>Roles: {f.allowedRoles.join(', ')}</span>
                      </div>
                    </td>
                    <td>
                      <div>{f.building}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>{f.floor}</div>
                    </td>
                    <td className="tabular">{f.capacity != null ? f.capacity : 'Unspecified'}</td>
                    <td className="tabular">
                      {f.openHour}–{f.closeHour}
                    </td>
                    <td>
                      <span
                        className={`status-text status-${f.status.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {f.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.45rem' }}>
                        <button
                          type="button"
                          className="btn btn-glass btn-sm"
                          onClick={() => openEdit(f)}
                          aria-label={`Edit ${f.name}`}
                        >
                          <Pencil size={14} aria-hidden="true" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger-ghost btn-sm"
                          onClick={() => handleDelete(f)}
                          aria-label={`Delete ${f.name}`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={editingId ? 'Edit Facility' : 'Create Facility'}>
          <div className="modal-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem' }}>
                {editingId ? 'Edit Facility' : 'Add Campus Facility'}
              </h2>
              <button
                type="button"
                className="btn btn-glass btn-sm"
                onClick={() => setModalOpen(false)}
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="form-grid-2">
                <div className="field-group">
                  <label htmlFor="fac-code" className="field-label">Room / Space Code</label>
                  <input
                    id="fac-code"
                    className="field-input"
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="fac-category" className="field-label">Category</label>
                  <select
                    id="fac-category"
                    className="field-select"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    <option value="Learning">Learning</option>
                    <option value="Administrative">Administrative</option>
                    <option value="Support">Support</option>
                  </select>
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="fac-name" className="field-label">Facility Name</label>
                <input
                  id="fac-name"
                  className="field-input"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="form-grid-2">
                <div className="field-group">
                  <label htmlFor="fac-building" className="field-label">Building</label>
                  <input
                    id="fac-building"
                    className="field-input"
                    required
                    value={form.building}
                    onChange={(e) => setForm({ ...form, building: e.target.value })}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="fac-floor" className="field-label">Building Floor</label>
                  <select
                    id="fac-floor"
                    className="field-select"
                    value={form.floor}
                    onChange={(e) => setForm({ ...form, floor: e.target.value })}
                  >
                    {CICS_FLOORS.map((fl) => (
                      <option key={fl} value={fl}>
                        {fl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="field-group">
                  <label htmlFor="fac-cap" className="field-label">Capacity (Optional)</label>
                  <input
                    id="fac-cap"
                    type="number"
                    min="1"
                    className="field-input"
                    placeholder="Unspecified in proposal"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="fac-status" className="field-label">Recorded Status</label>
                  <select
                    id="fac-status"
                    className="field-select"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="Available">Available</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Restricted">Restricted</option>
                  </select>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.88rem', color: 'var(--ink-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean(form.isReservable)}
                  onChange={(e) => setForm({ ...form, isReservable: e.target.checked })}
                />
                <span>Room accepts reservation bookings (checked for Learning rooms; unchecked for Administrative/Support directory entries)</span>
              </label>

              <div className="form-grid-2">
                <div className="field-group">
                  <label htmlFor="fac-open" className="field-label">Opening Hour</label>
                  <input
                    id="fac-open"
                    type="time"
                    className="field-input"
                    required
                    value={form.openHour}
                    onChange={(e) => setForm({ ...form, openHour: e.target.value })}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="fac-close" className="field-label">Closing Hour</label>
                  <input
                    id="fac-close"
                    type="time"
                    className="field-input"
                    required
                    value={form.closeHour}
                    onChange={(e) => setForm({ ...form, closeHour: e.target.value })}
                  />
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="fac-roles" className="field-label">Permitted Roles (comma-separated)</label>
                <input
                  id="fac-roles"
                  className="field-input"
                  required
                  value={form.allowedRoles}
                  onChange={(e) => setForm({ ...form, allowedRoles: e.target.value })}
                />
              </div>

              <div className="field-group">
                <label htmlFor="fac-amenities" className="field-label">Equipment & Amenities (comma-separated)</label>
                <input
                  id="fac-amenities"
                  className="field-input"
                  value={form.amenities}
                  onChange={(e) => setForm({ ...form, amenities: e.target.value })}
                />
              </div>

              <div className="field-group">
                <label htmlFor="fac-image-preset" className="field-label">Facility Photo Preset</label>
                <select
                  id="fac-image-preset"
                  className="field-select"
                  value={
                    FACILITY_MEDIA_PRESETS.some((img) => img.value === form.imageUrl)
                      ? form.imageUrl
                      : ''
                  }
                  onChange={(e) => {
                    if (e.target.value) {
                      setForm({ ...form, imageUrl: e.target.value });
                    }
                  }}
                >
                  <option value="">Custom photo path / URL below</option>
                  {FACILITY_MEDIA_PRESETS.map((img) => (
                    <option key={img.value} value={img.value}>
                      {img.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="fac-image-url" className="field-label">
                  Facility Photo Path or URL (Editable)
                </label>
                <input
                  id="fac-image-url"
                  type="text"
                  className="field-input"
                  placeholder="/assets/images/cics-classroom.jpg or https://..."
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                />
                <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                  Replace with an approved per-room photo path or URL at any time without modifying code.
                </span>
              </div>

              <div className="field-group">
                <label htmlFor="fac-desc" className="field-label">Description</label>
                <textarea
                  id="fac-desc"
                  className="field-textarea"
                  required
                  minLength={10}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-glass" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-coral" disabled={saving}>
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Facility'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
