'use client';

import { useState, useEffect, useCallback } from 'react';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import FormField from '@/components/FormField';
import Toast from '@/components/Toast';

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedOwner, setSelectedOwner] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Form Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [formData, setFormData] = useState({
    vehicle_number: '',
    model: '',
    battery_capacity: '',
    user_id: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingVehicle, setDeletingVehicle] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Fetch users for the owner dropdown
  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const json = await res.json();
      if (res.ok) setUsers(json.data || []);
    } catch {
      // Ignored; handled elsewhere
    }
  };

  const fetchVehicles = useCallback(async (ownerId = selectedOwner) => {
    setLoading(true);
    try {
      const url = ownerId ? `/api/vehicles?user_id=${ownerId}` : '/api/vehicles';
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch vehicles');
      setVehicles(json.data || []);
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }, [selectedOwner]);

  useEffect(() => {
    fetchUsers();
    fetchVehicles();
  }, [fetchVehicles]);

  const handleOpenAdd = () => {
    setEditingVehicle(null);
    setFormData({
      vehicle_number: '',
      model: '',
      battery_capacity: '',
      user_id: selectedOwner || (users[0]?.user_id ? String(users[0].user_id) : ''),
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleOpenEdit = (vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      vehicle_number: vehicle.vehicle_number || '',
      model: vehicle.model || '',
      battery_capacity: String(vehicle.battery_capacity) || '',
      user_id: String(vehicle.user_id) || '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    if (!formData.vehicle_number.trim()) {
      setFormErrors((prev) => ({ ...prev, vehicle_number: 'Registration number is required' }));
      return;
    }
    if (!formData.model.trim()) {
      setFormErrors((prev) => ({ ...prev, model: 'Model is required' }));
      return;
    }
    const cap = parseFloat(formData.battery_capacity);
    if (isNaN(cap) || cap <= 0) {
      setFormErrors((prev) => ({ ...prev, battery_capacity: 'Must be a positive decimal' }));
      return;
    }
    if (!formData.user_id) {
      setFormErrors((prev) => ({ ...prev, user_id: 'Owner is required' }));
      return;
    }

    setFormSubmitting(true);
    try {
      const method = editingVehicle ? 'PUT' : 'POST';
      const payload = editingVehicle ? { ...formData, vehicle_id: editingVehicle.vehicle_id } : formData;

      const res = await fetch('/api/vehicles', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Operation failed');

      setToast({
        type: 'success',
        message: editingVehicle ? 'Vehicle updated successfully' : 'Vehicle registered successfully',
      });
      setModalOpen(false);
      fetchVehicles(selectedOwner);
    } catch (err) {
      setToast({ type: 'error', message: err.message });
      if (err.message.toLowerCase().includes('registration') || err.message.toLowerCase().includes('already')) {
        setFormErrors({ vehicle_number: err.message });
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenDelete = (vehicle) => {
    setDeletingVehicle(vehicle);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingVehicle) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/vehicles?id=${deletingVehicle.vehicle_id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delete failed');

      setToast({ type: 'success', message: 'Vehicle deleted successfully' });
      setDeleteDialogOpen(false);
      fetchVehicles(selectedOwner);
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
      accessor: (row) => <span className="font-mono text-slate-500 font-semibold">#{row.vehicle_id}</span>,
      className: 'w-16',
    },
    {
      header: 'Registration No.',
      accessor: (row) => (
        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
          {row.vehicle_number}
        </span>
      ),
    },
    {
      header: 'Model',
      accessor: (row) => <span className="font-bold text-slate-800">{row.model}</span>,
    },
    {
      header: 'Battery Capacity',
      accessor: (row) => (
        <span className="font-medium text-slate-700">
          {Number(row.battery_capacity).toFixed(2)} <span className="text-xs text-slate-400">kWh</span>
        </span>
      ),
    },
    {
      header: 'Owner',
      accessor: (row) => (
        <div>
          <span className="font-bold text-slate-900 block">{row.owner_name}</span>
          <span className="text-[11px] text-slate-400 block">{row.owner_email}</span>
        </div>
      ),
    },
    {
      header: 'Sessions',
      accessor: (row) => (
        <span className="text-xs font-semibold text-slate-600">
          {row.session_count} session{row.session_count === 1 ? '' : 's'}
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
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mb-2">
            Module M2
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Vehicle Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Registered customer EV fleet, model specs, battery kWh capacities, and user ownership links.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 4v16m8-8H4" />
          </svg>
          Register Vehicle
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="ownerFilter" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
            Filter by Owner:
          </label>
          <select
            id="ownerFilter"
            value={selectedOwner}
            onChange={(e) => {
              setSelectedOwner(e.target.value);
              fetchVehicles(e.target.value);
            }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500 text-slate-700 font-medium"
          >
            <option value="">All Registered Owners</option>
            {users.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.name} (#{u.user_id})
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-500">
          Showing <strong className="text-slate-800 font-bold">{vehicles.length}</strong> vehicle{vehicles.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Main Vehicles Table */}
      <DataTable
        columns={columns}
        data={vehicles}
        loading={loading}
        keyField="vehicle_id"
        emptyTitle="No vehicles found"
        emptyDescription={selectedOwner ? "This customer does not have any vehicles registered." : "No electric vehicles currently registered in the database."}
        emptyActionLabel="Register Vehicle"
        onEmptyAction={handleOpenAdd}
      />

      {/* Add / Edit Vehicle Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingVehicle ? 'Edit Vehicle Details' : 'Register New Electric Vehicle'}
        subtitle={editingVehicle ? `Updating vehicle #${editingVehicle.vehicle_id}` : 'Linked directly to an existing registered customer profile'}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <FormField
            label="Vehicle Registration Number"
            name="vehicle_number"
            value={formData.vehicle_number}
            onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
            placeholder="e.g. EV-4004 or KA-01-AB-1234"
            required
            error={formErrors.vehicle_number}
            helpText="Must be unique across all vehicles (UNIQUE constraint)."
          />

          <FormField
            label="Make & Model"
            name="model"
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            placeholder="e.g. Tesla Model 3 or Tata Nexon EV"
            required
            error={formErrors.model}
          />

          <FormField
            label="Battery Capacity (kWh)"
            name="battery_capacity"
            type="number"
            step="0.01"
            min="1.0"
            max="999.99"
            value={formData.battery_capacity}
            onChange={(e) => setFormData({ ...formData, battery_capacity: e.target.value })}
            placeholder="e.g. 50.30"
            required
            error={formErrors.battery_capacity}
            helpText="Must be a positive decimal number."
          />

          <FormField
            label="Vehicle Owner"
            name="user_id"
            type="select"
            value={formData.user_id}
            onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
            options={users.map((u) => ({ label: `${u.name} (${u.email})`, value: u.user_id }))}
            placeholder="Select a registered customer"
            required
            error={formErrors.user_id}
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
              {editingVehicle ? 'Save Changes' : 'Register Vehicle'}
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
        title="Delete Vehicle"
        message={`Are you sure you want to delete vehicle "${deletingVehicle?.vehicle_number}" (${deletingVehicle?.model})? Deletion is blocked if this vehicle has recorded charging sessions.`}
        confirmText="Confirm Delete"
      />
    </div>
  );
}
