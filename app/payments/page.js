'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import FormField from '@/components/FormField';
import Toast from '@/components/Toast';

function PaymentsContent() {
  const searchParams = useSearchParams();
  const preselectedSessionId = searchParams.get('session_id');

  const [payments, setPayments] = useState([]);
  const [eligibleSessions, setEligibleSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Record Payment Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    session_id: '',
    amount: '',
    payment_method: 'UPI',
    payment_date: new Date().toISOString().slice(0, 10),
  });
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [calculatedCost, setCalculatedCost] = useState(null);
  const [selectedSessionInfo, setSelectedSessionInfo] = useState(null);

  // Delete Payment State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Fetch payments
  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payments');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch payments');
      setPayments(json.data || []);
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch eligible (unpaid completed) sessions
  const fetchEligibleSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/payments?eligible_sessions=true');
      const json = await res.json();
      if (res.ok) setEligibleSessions(json.data || []);
    } catch {
      // Handled gracefully
    }
  }, []);

  useEffect(() => {
    fetchPayments();
    fetchEligibleSessions();
  }, [fetchPayments, fetchEligibleSessions]);

  const handleOpenRecord = useCallback((sessionToPay = null) => {
    const today = new Date().toISOString().slice(0, 10);
    setFormErrors({});

    if (sessionToPay) {
      setSelectedSessionInfo(sessionToPay);
      const cost = sessionToPay.computed_cost !== null ? Number(sessionToPay.computed_cost).toFixed(2) : '';
      setCalculatedCost(sessionToPay.computed_cost !== null ? Number(sessionToPay.computed_cost) : null);
      setFormData({
        session_id: String(sessionToPay.session_id),
        amount: cost,
        payment_method: 'UPI',
        payment_date: today,
      });
    } else {
      const firstEligible = eligibleSessions[0];
      setSelectedSessionInfo(firstEligible || null);
      if (firstEligible) {
        const cost = firstEligible.computed_cost !== null ? Number(firstEligible.computed_cost).toFixed(2) : '';
        setCalculatedCost(firstEligible.computed_cost !== null ? Number(firstEligible.computed_cost) : null);
        setFormData({
          session_id: String(firstEligible.session_id),
          amount: cost,
          payment_method: 'UPI',
          payment_date: today,
        });
      } else {
        setCalculatedCost(null);
        setFormData({
          session_id: '',
          amount: '',
          payment_method: 'UPI',
          payment_date: today,
        });
      }
    }

    setModalOpen(true);
  }, [eligibleSessions]);

  // When a session is selected in the modal, fetch its fn_session_cost
  const handleSessionSelect = async (sessionId) => {
    const session = eligibleSessions.find((s) => String(s.session_id) === String(sessionId));
    setSelectedSessionInfo(session || null);

    if (!sessionId) {
      setFormData((prev) => ({ ...prev, session_id: '', amount: '' }));
      setCalculatedCost(null);
      return;
    }

    try {
      const res = await fetch(`/api/payments?calculate_cost=true&session_id=${sessionId}`);
      const json = await res.json();
      if (res.ok && json.cost !== null) {
        setCalculatedCost(Number(json.cost));
        setFormData((prev) => ({
          ...prev,
          session_id: sessionId,
          amount: Number(json.cost).toFixed(2),
        }));
      } else {
        setCalculatedCost(null);
        setFormData((prev) => ({ ...prev, session_id: sessionId, amount: '' }));
      }
    } catch {
      setCalculatedCost(null);
    }
  };

  // Handle URL preselection (e.g. from /sessions page "Collect" button)
  useEffect(() => {
    if (preselectedSessionId && eligibleSessions.length > 0) {
      const targetSession = eligibleSessions.find(
        (s) => String(s.session_id) === String(preselectedSessionId)
      );
      if (targetSession) {
        handleOpenRecord(targetSession);
      }
    }
  }, [preselectedSessionId, eligibleSessions, handleOpenRecord]);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    if (!formData.session_id) {
      setFormErrors((prev) => ({ ...prev, session_id: 'Please select a completed session to settle' }));
      return;
    }
    const amt = parseFloat(formData.amount);
    if (isNaN(amt) || amt < 0) {
      setFormErrors((prev) => ({ ...prev, amount: 'Payment amount must be a non-negative number' }));
      return;
    }

    setFormSubmitting(true);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: formData.session_id,
          amount: amt,
          payment_method: formData.payment_method,
          payment_date: formData.payment_date,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Payment recording failed');

      setToast({
        type: 'success',
        message: `Payment #${json.data?.payment_id} recorded successfully (Session #${formData.session_id} settled).`,
      });
      setModalOpen(false);
      fetchPayments();
      fetchEligibleSessions();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenDelete = (payment) => {
    setDeletingPayment(payment);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingPayment) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/payments?id=${deletingPayment.payment_id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete payment');

      setToast({
        type: 'success',
        message: 'Payment voided successfully. Associated session status reverted to Pending.',
      });
      setDeleteDialogOpen(false);
      fetchPayments();
      fetchEligibleSessions();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
      setDeleteDialogOpen(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Metrics summary
  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const avgPayment = payments.length > 0 ? totalRevenue / payments.length : 0;

  const columns = [
    {
      header: 'Receipt ID',
      accessor: (row) => (
        <div>
          <span className="font-mono text-slate-800 font-bold block">#{row.payment_id}</span>
          <span className="text-[10px] text-slate-400 font-mono">{row.payment_date}</span>
        </div>
      ),
      className: 'w-24',
    },
    {
      header: 'Settlement Amount',
      accessor: (row) => (
        <div>
          <span className="font-mono font-black text-slate-900 text-base block">
            ₹{Number(row.amount).toFixed(2)}
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
              {row.payment_method}
            </span>
            <span className="text-[10px] text-emerald-600 font-medium">fn_session_cost</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Charging Session Link',
      accessor: (row) => (
        <div>
          <span className="font-semibold text-slate-900 block">
            Session #{row.session_id}
          </span>
          <div className="text-xs text-slate-500 mt-0.5">
            <span>{Number(row.energy_consumed_kwh).toFixed(2)} kWh</span>
            <span className="mx-1 text-slate-300">&bull;</span>
            <span>{row.duration_minutes ? `${row.duration_minutes}m` : '—'}</span>
            <span className="mx-1 text-slate-300">&bull;</span>
            <span className="text-slate-600 font-medium">{row.plan_name}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Driver & Vehicle',
      accessor: (row) => (
        <div>
          <span className="font-bold text-slate-900 block">{row.user_name}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              {row.vehicle_number}
            </span>
            <span className="text-xs text-slate-400">{row.vehicle_model}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Station & Charger',
      accessor: (row) => (
        <div>
          <span className="font-semibold text-slate-800 block text-xs">{row.station_name}</span>
          <span className="text-[11px] text-slate-400 block">
            Point #{row.point_id} &bull; {row.connector_type}
          </span>
        </div>
      ),
    },
    {
      header: 'Integrity Rule',
      accessor: () => (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          1:1 Verified
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        [3, 4].includes(row.payment_id) ? (
          <span className="text-[10px] text-slate-400 font-semibold px-2 py-1 bg-slate-50 rounded border border-slate-200">
            Sample Record
          </span>
        ) : (
          <button
            onClick={() => handleOpenDelete(row)}
            className="p-1.5 text-xs font-semibold rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
            title="Delete payment record (reverts session status to Pending)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )
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
            Module M6
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Payment Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict 1:1 session settlement, stored function billing via <code>fn_session_cost()</code>, and payment trigger protection.
          </p>
        </div>

        <button
          onClick={() => handleOpenRecord()}
          disabled={eligibleSessions.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M12 4v16m8-8H4" />
          </svg>
          Record Payment
        </button>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Revenue Settled
          </span>
          <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
            ₹{totalRevenue.toFixed(2)}
          </span>
          <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
            Live database records
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Settled Invoices
          </span>
          <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
            {payments.length}
          </span>
          <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
            1:1 UNIQUE protected
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Unpaid Completed Sessions
          </span>
          <span className="text-2xl font-black text-amber-600 font-mono mt-1 block">
            {eligibleSessions.length}
          </span>
          <span className="text-[11px] text-amber-700 font-semibold mt-0.5 block">
            {eligibleSessions.length === 0 ? 'All accounts balanced' : 'Awaiting collection'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Average Ticket
          </span>
          <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
            ₹{avgPayment.toFixed(2)}
          </span>
          <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
            per completed session
          </span>
        </div>
      </div>

      {/* Unpaid / Pending Bills Banner (if any) */}
      {eligibleSessions.length > 0 && (
        <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              <h2 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Pending Settlements ({eligibleSessions.length} Unpaid Session{eligibleSessions.length === 1 ? '' : 's'})
              </h2>
            </div>
            <span className="text-[11px] text-amber-700 font-medium">
              Identified via <code>NOT EXISTS (SELECT 1 FROM payment)</code>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {eligibleSessions.map((es) => (
              <div
                key={es.session_id}
                className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-xs text-slate-900">
                      Session #{es.session_id}
                    </span>
                    <span className="text-[11px] text-slate-500">&bull; {es.user_name}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {es.vehicle_number} &bull; {Number(es.energy_consumed_kwh).toFixed(2)} kWh
                  </div>
                  <div className="font-mono font-extrabold text-sm text-emerald-700 mt-1">
                    ₹{Number(es.computed_cost).toFixed(2)}
                  </div>
                </div>

                <button
                  onClick={() => handleOpenRecord(es)}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-colors shrink-0"
                >
                  Settle Bill
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Payments Data Table */}
      <DataTable
        columns={columns}
        data={payments}
        loading={loading}
        keyField="payment_id"
        emptyTitle="No payment records found"
        emptyDescription="No settlements have been recorded in the database yet."
        emptyActionLabel={eligibleSessions.length > 0 ? 'Record Payment' : undefined}
        onEmptyAction={eligibleSessions.length > 0 ? () => handleOpenRecord() : undefined}
      />

      {/* Record Payment Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Session Payment"
        subtitle="Enforces 1:1 constraint, verifies completed status, and executes fn_session_cost()."
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {/* Target Session Selection */}
          <FormField
            label="1. Target Completed Session"
            name="session_id"
            type="select"
            value={formData.session_id}
            onChange={(e) => handleSessionSelect(e.target.value)}
            options={eligibleSessions.map((s) => ({
              label: `Session #${s.session_id} — ${s.user_name} (${s.vehicle_number}) &bull; ${s.energy_consumed_kwh} kWh &bull; ₹${Number(s.computed_cost).toFixed(2)}`,
              value: s.session_id,
            }))}
            placeholder={
              eligibleSessions.length === 0
                ? 'No unpaid completed sessions found'
                : 'Select an unpaid completed session'
            }
            required
            error={formErrors.session_id}
            helpText="Only completed sessions without an existing payment are eligible (1:1 constraint)."
          />

          {/* Session Detail & Breakdown Card */}
          {selectedSessionInfo && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
              <span className="font-bold text-slate-800 block">Session Breakdown &amp; Tariff</span>
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Driver:</span>
                  <span className="font-semibold text-slate-900">{selectedSessionInfo.user_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Vehicle:</span>
                  <span className="font-mono font-semibold text-slate-900">{selectedSessionInfo.vehicle_number}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Energy Consumed:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {Number(selectedSessionInfo.energy_consumed_kwh).toFixed(2)} kWh
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Tariff Rate:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {selectedSessionInfo.plan_name} (₹{Number(selectedSessionInfo.rate_per_kwh).toFixed(2)}/kWh)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Stored Function Cost Preview */}
          {calculatedCost !== null && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-emerald-900 block">
                  Computed via Stored Function <code>fn_session_cost()</code>
                </span>
                <span className="text-[11px] text-emerald-700">
                  Formula: {selectedSessionInfo?.energy_consumed_kwh} kWh &times; ₹{Number(selectedSessionInfo?.rate_per_kwh).toFixed(2)}
                </span>
              </div>
              <span className="font-mono text-xl font-black text-emerald-800">
                ₹{calculatedCost.toFixed(2)}
              </span>
            </div>
          )}

          {/* Payment Method & Date */}
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="2. Payment Method"
              name="payment_method"
              type="select"
              value={formData.payment_method}
              onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
              options={[
                { label: 'UPI (Google Pay / PhonePe)', value: 'UPI' },
                { label: 'Credit / Debit Card', value: 'Card' },
                { label: 'Cash Settlement', value: 'Cash' },
                { label: 'Net Banking', value: 'Net Banking' },
              ]}
              required
              error={formErrors.payment_method}
            />

            <FormField
              label="3. Payment Date"
              name="payment_date"
              type="date"
              value={formData.payment_date}
              onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
              required
              error={formErrors.payment_date}
            />
          </div>

          {/* Amount Field */}
          <FormField
            label="4. Settled Amount (₹)"
            name="amount"
            type="number"
            step="0.01"
            min="0.00"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            placeholder="0.00"
            required
            error={formErrors.amount}
            helpText="Guarded against negative values at both API and trigger level (trg_payment_bi)."
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
              disabled={formSubmitting || !formData.session_id}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {formSubmitting && (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Confirm Settlement
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Payment Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
        title="Delete Payment Record"
        message={`Are you sure you want to delete payment record #${deletingPayment?.payment_id} (₹${deletingPayment?.amount}, ${deletingPayment?.payment_method})? The associated charging session #${deletingPayment?.session_id} will revert to 'Pending' payment status.`}
        confirmText="Delete Payment"
      />
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
        </div>
      }
    >
      <PaymentsContent />
    </Suspense>
  );
}
