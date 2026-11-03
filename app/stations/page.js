'use client';

import { useState, useEffect, useCallback } from 'react';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import FormField from '@/components/FormField';
import StatusBadge from '@/components/StatusBadge';
import Toast from '@/components/Toast';

export default function StationsPage() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Form Modal State (Add / Edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    total_slots: '10',
    status: 'active',
    contact_number: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Station Detail Modal State (Read-only Energy Mix + Points)
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [stationDetail, setStationDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingStation, setDeletingStation] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchStations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stations');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch stations');
      setStations(json.data || []);
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  const handleOpenAdd = () => {
    setEditingStation(null);
    setFormData({
      name: '',
      location: '',
      total_slots: '10',
      status: 'active',
      contact_number: '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleOpenEdit = (station) => {
    setEditingStation(station);
    setFormData({
      name: station.name || '',
      location: station.location || '',
      total_slots: String(station.total_slots || '10'),
      status: station.status || 'active',
      contact_number: station.contact_number || '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleOpenDetail = async (station) => {
    setDetailLoading(true);
    setDetailModalOpen(true);
    try {
      const res = await fetch(`/api/stations/${station.station_id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load station details');
      setStationDetail(json.data);
    } catch (err) {
      setToast({ type: 'error', message: err.message });
      setDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    if (!formData.name.trim()) {
      setFormErrors((prev) => ({ ...prev, name: 'Station name is required' }));
      return;
    }
    if (!formData.location.trim()) {
      setFormErrors((prev) => ({ ...prev, location: 'Location is required' }));
      return;
    }
    const slots = parseInt(formData.total_slots, 10);
    if (isNaN(slots) || slots < 1) {
      setFormErrors((prev) => ({ ...prev, total_slots: 'Slots must be a positive integer >= 1' }));
      return;
    }

    setFormSubmitting(true);
    try {
      const method = editingStation ? 'PUT' : 'POST';
      const payload = editingStation ? { ...formData, station_id: editingStation.station_id } : formData;

      const res = await fetch('/api/stations', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Operation failed');

      setToast({
        type: 'success',
        message: editingStation ? 'Station updated successfully' : 'Station added successfully',
      });
      setModalOpen(false);
      fetchStations();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenDelete = (station) => {
    setDeletingStation(station);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingStation) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/stations?id=${deletingStation.station_id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delete failed');

      setToast({ type: 'success', message: 'Station deleted successfully' });
      setDeleteDialogOpen(false);
      fetchStations();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
      setDeleteDialogOpen(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns = [
    {
      header: 'ID',
      accessor: (row) => <span className="font-mono text-slate-500 font-semibold">#{row.station_id}</span>,
      className: 'w-16',
    },
    {
      header: 'Station Name',
      accessor: (row) => (
        <div>
          <span className="font-bold text-slate-900 block">{row.name}</span>
          <span className="text-[11px] text-slate-400 block">{row.location}</span>
        </div>
      ),
    },
    {
      header: 'Operational Status',
      accessor: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Slots / Points',
      accessor: (row) => (
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-900">{row.point_count}</span>
          <span className="text-slate-400">/</span>
          <span className="text-slate-600 font-medium">{row.total_slots} slots</span>
          {row.point_count > row.total_slots && (
            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
              Over capacity
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Contact Number',
      accessor: (row) => (
        <span className="font-mono text-xs text-slate-600">
          {row.contact_number || <span className="text-slate-400 font-sans">—</span>}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleOpenDetail(row)}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            Energy &amp; Points
          </button>
          <button
            onClick={() => handleOpenEdit(row)}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => handleOpenDelete(row)}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
          >
            Delete
          </button>
        </div>
      ),
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 text-xs font-bold mb-2">
            Module M3
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Charging Station Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational facility hubs, physical parking slot limits, and clean energy source mix (SUPPLIES).
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 4v16m8-8H4" />
          </svg>
          Add Station
        </button>
      </div>

      {/* Main Stations Table */}
      <DataTable
        columns={columns}
        data={stations}
        loading={loading}
        keyField="station_id"
        emptyTitle="No charging stations found"
        emptyDescription="Get started by configuring your first charging facility."
        emptyActionLabel="Add Station"
        onEmptyAction={handleOpenAdd}
      />

      {/* Station Detail Modal: Charging Points & Energy Source Mix */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={stationDetail ? `${stationDetail.name} — Facility Details` : 'Station Details'}
        subtitle={`Location: ${stationDetail?.location || '—'} | Status: ${stationDetail?.status?.toUpperCase() || ''}`}
        maxWidth="max-w-2xl"
      >
        {detailLoading ? (
          <div className="py-12 flex justify-center items-center">
            <svg className="w-6 h-6 animate-spin text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        ) : stationDetail ? (
          <div className="space-y-6">
            {/* Energy Source Mix Section (Read-only from station_energy_source JOIN energy_source) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Clean Energy Mix (station_energy_source)
                </h4>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500">Total Allocation:</span>
                  <span
                    className={`font-black font-mono px-2 py-0.5 rounded-full text-[11px] ${
                      stationDetail.is_allocation_complete
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {stationDetail.total_allocation_pct}%
                  </span>
                </div>
              </div>

              {!stationDetail.is_allocation_complete && (
                <div className="p-2.5 mb-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>
                    <strong>Energy Allocation Warning:</strong> Energy allocation total is <strong>{stationDetail.total_allocation_pct}%</strong> (does not equal 100%).
                  </span>
                </div>
              )}

              {stationDetail.energy_sources && stationDetail.energy_sources.length > 0 ? (
                <div className="rounded-xl border border-slate-200 overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                      <tr>
                        <th className="px-4 py-2.5">Source Type</th>
                        <th className="px-4 py-2.5">Capacity (kW)</th>
                        <th className="px-4 py-2.5 text-right">Station Allocation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stationDetail.energy_sources.map((es, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 font-bold text-slate-800">{es.source_type}</td>
                          <td className="px-4 py-2.5 font-mono text-slate-600">
                            {Number(es.capacity_kw).toFixed(2)} kW
                          </td>
                          <td className="px-4 py-2.5 font-mono font-bold text-slate-900 text-right">
                            {Number(es.allocation_pct).toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No energy source allocations linked to this station.</p>
              )}
            </div>

            {/* Installed Charging Points Section */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Installed Chargers ({stationDetail.points?.length || 0} Points)
              </h4>

              {stationDetail.points && stationDetail.points.length > 0 ? (
                <div className="rounded-xl border border-slate-200 overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                      <tr>
                        <th className="px-4 py-2.5">Point ID</th>
                        <th className="px-4 py-2.5">Connector Type</th>
                        <th className="px-4 py-2.5">Power Rating</th>
                        <th className="px-4 py-2.5 text-right">Current Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stationDetail.points.map((pt) => (
                        <tr key={pt.point_id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 font-mono font-semibold text-slate-600">#{pt.point_id}</td>
                          <td className="px-4 py-2.5 font-bold text-slate-800">{pt.connector_type}</td>
                          <td className="px-4 py-2.5 font-mono text-slate-600">
                            {Number(pt.power_rating_kw).toFixed(2)} kW
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <StatusBadge status={pt.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No charging points installed at this station yet.</p>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200"
              >
                Close View
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Add / Edit Station Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingStation ? 'Edit Charging Station' : 'Create Charging Station'}
        subtitle={editingStation ? `Updating station #${editingStation.station_id}` : 'Configure facility slots, location, and operational status'}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <FormField
            label="Station Facility Name"
            name="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Mumbai Central Charging Hub"
            required
            error={formErrors.name}
          />

          <FormField
            label="Physical Location"
            name="location"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="e.g. Mumbai, Maharashtra"
            required
            error={formErrors.location}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Total Slot Limit"
              name="total_slots"
              type="number"
              min="1"
              value={formData.total_slots}
              onChange={(e) => setFormData({ ...formData, total_slots: e.target.value })}
              required
              error={formErrors.total_slots}
              helpText="Planned physical vehicle parking slots."
            />

            <FormField
              label="Operational Status"
              name="status"
              type="select"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              options={[
                { label: 'Active', value: 'active' },
                { label: 'Maintenance', value: 'maintenance' },
              ]}
              required
            />
          </div>

          <FormField
            label="Contact Phone Number"
            name="contact_number"
            value={formData.contact_number}
            onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
            placeholder="e.g. +91-22-22001004"
            helpText="Emergency or operator hotline contact_number."
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {formSubmitting && (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {editingStation ? 'Save Changes' : 'Create Station'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
        title="Delete Charging Station"
        message={`Are you sure you want to delete station "${deletingStation?.name}"? Deletion is blocked if this station currently has charging points installed.`}
        confirmText="Confirm Delete"
      />
    </div>
  );
}
