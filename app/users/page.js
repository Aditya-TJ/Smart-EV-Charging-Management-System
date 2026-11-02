'use client';

import { useState, useEffect, useCallback } from 'react';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import FormField from '@/components/FormField';
import Toast from '@/components/Toast';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  // Form Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '' });
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchUsers = useCallback(async (query = search) => {
    setLoading(true);
    try {
      const url = query ? `/api/users?search=${encodeURIComponent(query)}` : '/api/users';
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch users');
      setUsers(json.data || []);
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, fetchUsers]);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({ name: '', email: '', phone: '', address: '' });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      address: user.address || '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    // Client-side quick check
    if (!formData.name.trim()) {
      setFormErrors((prev) => ({ ...prev, name: 'Name is required' }));
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setFormErrors((prev) => ({ ...prev, email: 'A valid email is required' }));
      return;
    }

    setFormSubmitting(true);
    try {
      const method = editingUser ? 'PUT' : 'POST';
      const payload = editingUser ? { ...formData, user_id: editingUser.user_id } : formData;

      const res = await fetch('/api/users', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Operation failed');

      setToast({
        type: 'success',
        message: editingUser ? 'User updated successfully' : 'User registered successfully',
      });
      setModalOpen(false);
      fetchUsers(search);
    } catch (err) {
      setToast({ type: 'error', message: err.message });
      if (err.message.toLowerCase().includes('email')) {
        setFormErrors({ email: err.message });
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenDelete = (user) => {
    setDeletingUser(user);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/users?id=${deletingUser.user_id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delete failed');

      setToast({ type: 'success', message: 'User deleted successfully' });
      setDeleteDialogOpen(false);
      fetchUsers(search);
    } catch (err) {
      setToast({ type: 'error', message: err.message });
      setDeleteDialogOpen(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns = [
    {
      header: 'User ID',
      accessor: (row) => <span className="font-mono text-slate-500 font-semibold">#{row.user_id}</span>,
      className: 'w-20',
    },
    {
      header: 'Name',
      accessor: (row) => <span className="font-bold text-slate-900">{row.name}</span>,
    },
    {
      header: 'Email',
      accessor: 'email',
    },
    {
      header: 'Phone',
      accessor: (row) => row.phone || <span className="text-slate-400">—</span>,
    },
    {
      header: 'Vehicles',
      accessor: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          {row.vehicle_count} {row.vehicle_count === 1 ? 'vehicle' : 'vehicles'}
        </span>
      ),
    },
    {
      header: 'Address',
      accessor: (row) => (
        <span className="text-slate-500 max-w-xs truncate block" title={row.address}>
          {row.address || '—'}
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
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold mb-2">
            Module M1
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">User Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Registered customer accounts, contact details, and linked vehicle counts (LEFT JOIN + GROUP BY).
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 4v16m8-8H4" />
          </svg>
          Add Customer
        </button>
      </div>

      {/* Search Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3">
        <svg className="w-4 h-4 text-slate-400 shrink-0 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers by name, email, or phone number..."
          className="w-full text-xs bg-transparent border-0 focus:outline-none text-slate-800 placeholder-slate-400"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-xs text-slate-400 hover:text-slate-600 px-2"
          >
            Clear
          </button>
        )}
      </div>

      {/* Main Users Table */}
      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        keyField="user_id"
        emptyTitle="No customers registered"
        emptyDescription={search ? "No users matched your search criteria." : "Get started by adding your first registered EV customer."}
        emptyActionLabel={search ? "Clear Search" : "Add Customer"}
        onEmptyAction={search ? () => setSearch('') : handleOpenAdd}
      />

      {/* Add / Edit User Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUser ? 'Edit Customer Profile' : 'Register New EV Customer'}
        subtitle={editingUser ? `Updating account for User #${editingUser.user_id}` : 'All inputs are validated server-side against unique constraints'}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <FormField
            label="Full Name"
            name="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Eleanor Vance"
            required
            error={formErrors.name}
          />

          <FormField
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="e.g. eleanor@example.com"
            required
            error={formErrors.email}
            helpText="Must be unique across all customer profiles (UNIQUE constraint)."
          />

          <FormField
            label="Phone Number"
            name="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="e.g. 555-0145"
            error={formErrors.phone}
          />

          <FormField
            label="Street Address"
            name="address"
            type="textarea"
            rows={2}
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="e.g. 742 Evergreen Terrace, Springfield"
            error={formErrors.address}
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
              {editingUser ? 'Save Changes' : 'Create User'}
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
        title="Delete Customer Account"
        message={`Are you sure you want to permanently remove "${deletingUser?.name}" (User #${deletingUser?.user_id}) from the database? This action is blocked if the user currently owns registered vehicles.`}
        confirmText="Confirm Delete"
      />
    </div>
  );
}
