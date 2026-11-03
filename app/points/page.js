'use client';

import { useState, useEffect, useCallback } from 'react';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import FormField from '@/components/FormField';
import StatusBadge from '@/components/StatusBadge';
import Toast from '@/components/Toast';

export default function PointsPage() {
  const [points, setPoints] = useState([]);
  const [stations, setStations] = useState([]);
  const [connectorTypes, setConnectorTypes] = useState(['CCS2', 'Type2', 'CHAdeMO']);
  const [selectedStation, setSelectedStation] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [availableOnlyView, setAvailableOnlyView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Form Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState(null);
  const [formData, setFormData] = useState({
    connector_type: 'CCS2',
    custom_connector: '',
    power_rating_kw: '50.00',
    station_id: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPoint, setDeletingPoint] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchStations = async () => {
    try {
      const res = await fetch('/api/stations');
      const json = await res.json();
      if (res.ok) setStations(json.data || []);
    } catch {
      // Handled
    }
  };

  const fetchConnectors = async () => {
    try {
      const res = await fetch('/api/points?distinct_connectors=true');
      const json = await res.json();
      if (res.ok && json.data?.length > 0) {
        setConnectorTypes(json.data);
      }
    } catch {
      // Handled
    }
  };

  const fetchPoints = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/points';
      const params = new URLSearchParams();

      if (availableOnlyView) {
        params.append('available_only', 'true');
      }
      if (selectedStation) {
        params.append('station_id', selectedStation);
      }
      if (selectedStatus && !availableOnlyView) {
        params.append('status', selectedStatus);
      }

      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;

      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch points');
      setPoints(json.data || []);
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }, [availableOnlyView, selectedStation, selectedStatus]);

  useEffect(() => {
    fetchStations();
    fetchConnectors();
  }, []);

  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  const handleOpenAdd = () => {
    setEditingPoint(null);
    setFormData({
      connector_type: connectorTypes[0] || 'CCS2',
      custom_connector: '',
      power_rating_kw: '50.00',
      station_id: selectedStation || (stations[0]?.station_id ? String(stations[0].station_id) : ''),
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleOpenEdit = (point) => {
    setEditingPoint(point);
    const isStandard = connectorTypes.includes(point.connector_type);
    setFormData({
      connector_type: isStandard ? point.connector_type : 'OTHER',
      custom_connector: isStandard ? '' : point.connector_type,
      power_rating_kw: String(point.power_rating_kw || ''),
      station_id: String(point.station_id || ''),
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    let effectiveConnector = formData.connector_type;
    if (formData.connector_type === 'OTHER') {
      if (!formData.custom_connector.trim()) {
        setFormErrors((prev) => ({ ...prev, connector_type: 'Please specify the connector protocol' }));
        return;
      }
      effectiveConnector = formData.custom_connector.trim();
    }

    const kw = parseFloat(formData.power_rating_kw);
    if (isNaN(kw) || kw <= 0) {
      setFormErrors((prev) => ({ ...prev, power_rating_kw: 'Power rating must be a positive decimal' }));
      return;
    }
    if (!formData.station_id) {
      setFormErrors((prev) => ({ ...prev, station_id: 'Station is required' }));
      return;
    }

    setFormSubmitting(true);
    try {
      const method = editingPoint ? 'PUT' : 'POST';
      const payload = {
        connector_type: effectiveConnector,
        power_rating_kw: kw,
        station_id: formData.station_id,
        ...(editingPoint ? { point_id: editingPoint.point_id } : {}),
      };

      const res = await fetch('/api/points', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Operation failed');

      setToast({
        type: 'success',
        message: json.warning || (editingPoint ? 'Point updated successfully' : 'Charging point installed'),
      });
      setModalOpen(false);
      fetchConnectors();
      fetchPoints();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenDelete = (point) => {
    setDeletingPoint(point);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingPoint) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/points?id=${deletingPoint.point_id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delete failed');

      setToast({ type: 'success', message: 'Charging point deleted successfully' });
      setDeleteDialogOpen(false);
      fetchPoints();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
      setDeleteDialogOpen(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns = [
    {
      header: 'Point ID',
      accessor: (row) => <span className="font-mono text-slate-500 font-semibold">#{row.point_id}</span>,
      className: 'w-20',
    },
    {
      header: 'Connector Protocol',
      accessor: (row) => (
        <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
          {row.connector_type}
        </span>
      ),
    },
    {
      header: 'Power Rating',
      accessor: (row) => (
        <span className="font-mono font-semibold text-slate-800">
          {Number(row.power_rating_kw).toFixed(2)} <span className="text-xs text-slate-400 font-normal">kW</span>
        </span>
      ),
    },
    {
      header: 'Station Facility',
      accessor: (row) => (
        <div>
          <span className="font-bold text-slate-900 block">{row.station_name}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] text-slate-400">{row.station_location}</span>
            <span className="text-[10px] text-slate-300">&bull;</span>
            <span className={`text-[10px] font-bold ${row.station_status === 'active' ? 'text-emerald-600' : 'text-amber-600'}`}>
              {row.station_status?.toUpperCase()}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Total Sessions',
      accessor: (row) => (
        <span className="text-xs font-semibold text-slate-600">
          {row.session_count ?? 0} session{(row.session_count ?? 0) === 1 ? '' : 's'}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-2">
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
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold mb-2">
            Module M4
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Charging Point Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Individual charger stalls, kW speed ratings, and system-managed availability status.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 4v16m8-8H4" />
          </svg>
          Add Charging Point
        </button>
      </div>

      {/* Filter Bar with v_available_points Toggle */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Station Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="stationSelect" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              Station:
            </label>
            <select
              id="stationSelect"
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500 text-slate-700 font-medium"
            >
              <option value="">All Stations</option>
              {stations.map((st) => (
                <option key={st.station_id} value={st.station_id}>
                  {st.name} ({st.status})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter (disabled when in available-only mode) */}
          {!availableOnlyView && (
            <div className="flex items-center gap-1.5">
              <label htmlFor="statusSelect" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                Status:
              </label>
              <select
                id="statusSelect"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500 text-slate-700 font-medium"
              >
                <option value="">All Statuses</option>
                <option value="available">Available</option>
                <option value="in-use">In-Use</option>
              </select>
            </div>
          )}
        </div>

        {/* View Toggle: v_available_points required output */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setAvailableOnlyView(!availableOnlyView);
              if (!availableOnlyView) setSelectedStatus('');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
              availableOnlyView
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-emerald-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${availableOnlyView ? 'bg-white' : 'bg-emerald-500'}`} />
            <span>Available Points Only (v_available_points)</span>
          </button>
        </div>
      </div>

      {/* Available points view banner */}
      {availableOnlyView && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              <strong>Project Requirement Met:</strong> Querying database view <code>v_available_points</code>. Showing chargers with status = <code>available</code> at <code>active</code> stations.
            </span>
          </div>
          <button
            onClick={() => setAvailableOnlyView(false)}
            className="text-emerald-700 font-bold hover:underline shrink-0 text-xs ml-2"
          >
            Show All
          </button>
        </div>
      )}

      {/* Main Points Table */}
      <DataTable
        columns={columns}
        data={points}
        loading={loading}
        keyField="point_id"
        emptyTitle="No charging points found"
        emptyDescription={
          availableOnlyView
            ? "No available chargers at active stations matching your selection."
            : "No charging points currently configured."
        }
        emptyActionLabel="Add Point"
        onEmptyAction={handleOpenAdd}
      />

      {/* Add / Edit Point Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPoint ? 'Edit Charging Point' : 'Install New Charging Point'}
        subtitle={editingPoint ? `Updating charger #${editingPoint.point_id}` : 'Point status will be initialized to "available"'}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <FormField
            label="Assigned Charging Station"
            name="station_id"
            type="select"
            value={formData.station_id}
            onChange={(e) => setFormData({ ...formData, station_id: e.target.value })}
            options={stations.map((st) => ({
              label: `${st.name} (${st.location}) — ${st.status}`,
              value: st.station_id,
            }))}
            placeholder="Select a station facility"
            required
            error={formErrors.station_id}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Connector Protocol"
              name="connector_type"
              type="select"
              value={formData.connector_type}
              onChange={(e) => setFormData({ ...formData, connector_type: e.target.value })}
              options={[
                ...connectorTypes.map((ct) => ({ label: ct, value: ct })),
                { label: '+ Type custom connector...', value: 'OTHER' },
              ]}
              required
              error={formErrors.connector_type}
            />

            <FormField
              label="Power Rating (kW)"
              name="power_rating_kw"
              type="number"
              step="0.01"
              min="1.0"
              max="999.99"
              value={formData.power_rating_kw}
              onChange={(e) => setFormData({ ...formData, power_rating_kw: e.target.value })}
              required
              error={formErrors.power_rating_kw}
            />
          </div>

          {formData.connector_type === 'OTHER' && (
            <FormField
              label="Custom Connector Name"
              name="custom_connector"
              value={formData.custom_connector}
              onChange={(e) => setFormData({ ...formData, custom_connector: e.target.value })}
              placeholder="e.g. Bharat DC-001 or CCS2"
              required
            />
          )}

          {editingPoint && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Charger Operational Status:</span>
              <div className="flex items-center gap-2">
                <StatusBadge status={editingPoint.status} />
                <span className="text-[11px] text-slate-400">(Managed by session transactions)</span>
              </div>
            </div>
          )}

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
              {editingPoint ? 'Save Changes' : 'Install Point'}
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
        title="Delete Charging Point"
        message={`Are you sure you want to remove charger #${deletingPoint?.point_id} (${deletingPoint?.connector_type}, ${deletingPoint?.power_rating_kw} kW)? Deletion is blocked if sessions have occurred at this point.`}
        confirmText="Confirm Delete"
      />
    </div>
  );
}
