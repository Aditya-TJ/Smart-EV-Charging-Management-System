'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import FormField from '@/components/FormField';
import StatusBadge from '@/components/StatusBadge';
import Toast from '@/components/Toast';

export default function SessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [users, setUsers] = useState([]);
  const [allVehicles, setAllVehicles] = useState([]);
  const [stations, setStations] = useState([]);
  const [points, setPoints] = useState([]);
  const [tariffPlans, setTariffPlans] = useState([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [unpaidOnlyFilter, setUnpaidOnlyFilter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Start Session Modal State
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [startForm, setStartForm] = useState({
    user_id: '',
    vehicle_id: '',
    station_id: '',
    point_id: '',
    plan_id: '',
    session_type: 'ongoing', // 'ongoing' or 'completed'
    start_time: '',
    end_time: '',
    energy_consumed_kwh: '0.00',
  });
  const [startErrors, setStartErrors] = useState({});
  const [startSubmitting, setStartSubmitting] = useState(false);

  // Complete Session Modal State
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completingSession, setCompletingSession] = useState(null);
  const [completeForm, setCompleteForm] = useState({
    energy_consumed_kwh: '',
    end_time: '',
  });
  const [completeErrors, setCompleteErrors] = useState({});
  const [completeSubmitting, setCompleteSubmitting] = useState(false);

  // Delete Session Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSession, setDeletingSession] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Fetch lookups
  const fetchLookups = async () => {
    try {
      const [uRes, vRes, sRes, pRes, tRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/vehicles'),
        fetch('/api/stations'),
        fetch('/api/points'),
        fetch('/api/tariff-plans'),
      ]);

      const [uJson, vJson, sJson, pJson, tJson] = await Promise.all([
        uRes.json(),
        vRes.json(),
        sRes.json(),
        pRes.json(),
        tRes.json(),
      ]);

      if (uRes.ok) setUsers(uJson.data || []);
      if (vRes.ok) setAllVehicles(vJson.data || []);
      if (sRes.ok) setStations(sJson.data || []);
      if (pRes.ok) setPoints(pJson.data || []);
      if (tRes.ok) setTariffPlans(tJson.data || []);
    } catch {
      // Lookups handled gracefully
    }
  };

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (userFilter) params.append('user_id', userFilter);
      if (stationFilter) params.append('station_id', stationFilter);
      if (unpaidOnlyFilter) params.append('unpaid_only', 'true');

      const url = `/api/sessions?${params.toString()}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch sessions');
      setSessions(json.data || []);
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, userFilter, stationFilter, unpaidOnlyFilter]);

  useEffect(() => {
    fetchLookups();
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Derived filtered vehicles based on selected user
  const userVehicles = allVehicles.filter(
    (v) => String(v.user_id) === String(startForm.user_id)
  );

  // Derived filtered points based on selected station
  const stationPoints = points.filter(
    (p) =>
      String(p.station_id) === String(startForm.station_id) &&
      (startForm.session_type === 'completed' || p.status === 'available')
  );

  const handleOpenStart = () => {
    const defaultUser = users[0]?.user_id ? String(users[0].user_id) : '';
    const userFirstVeh = allVehicles.find((v) => String(v.user_id) === defaultUser);
    const defaultStation = stations[0]?.station_id ? String(stations[0].station_id) : '';
    const availPoint = points.find(
      (p) => String(p.station_id) === defaultStation && p.status === 'available'
    );
    const defaultPlan = tariffPlans[0]?.plan_id ? String(tariffPlans[0].plan_id) : '';

    const now = new Date();
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    setStartForm({
      user_id: defaultUser,
      vehicle_id: userFirstVeh ? String(userFirstVeh.vehicle_id) : '',
      station_id: defaultStation,
      point_id: availPoint ? String(availPoint.point_id) : '',
      plan_id: defaultPlan,
      session_type: 'ongoing',
      start_time: localNow,
      end_time: '',
      energy_consumed_kwh: '0.00',
    });
    setStartErrors({});
    setStartModalOpen(true);
  };

  const handleUserChange = (newUserId) => {
    const firstVeh = allVehicles.find((v) => String(v.user_id) === String(newUserId));
    setStartForm((prev) => ({
      ...prev,
      user_id: newUserId,
      vehicle_id: firstVeh ? String(firstVeh.vehicle_id) : '',
    }));
  };

  const handleStationChange = (newStationId) => {
    const availPoint = points.find(
      (p) =>
        String(p.station_id) === String(newStationId) &&
        (startForm.session_type === 'completed' || p.status === 'available')
    );
    setStartForm((prev) => ({
      ...prev,
      station_id: newStationId,
      point_id: availPoint ? String(availPoint.point_id) : '',
    }));
  };

  const handleStartSubmit = async (e) => {
    e.preventDefault();
    setStartErrors({});

    if (!startForm.user_id) {
      setStartErrors((prev) => ({ ...prev, user_id: 'User is required' }));
      return;
    }
    if (!startForm.vehicle_id) {
      setStartErrors((prev) => ({ ...prev, vehicle_id: 'Vehicle is required' }));
      return;
    }
    if (!startForm.point_id) {
      setStartErrors((prev) => ({ ...prev, point_id: 'Charging point is required' }));
      return;
    }
    if (!startForm.plan_id) {
      setStartErrors((prev) => ({ ...prev, plan_id: 'Tariff plan is required' }));
      return;
    }

    if (startForm.session_type === 'completed') {
      if (!startForm.end_time) {
        setStartErrors((prev) => ({ ...prev, end_time: 'End time is required' }));
        return;
      }
      const kwh = parseFloat(startForm.energy_consumed_kwh);
      if (isNaN(kwh) || kwh < 0) {
        setStartErrors((prev) => ({ ...prev, energy_consumed_kwh: 'Valid kWh consumed is required' }));
        return;
      }
    }

    setStartSubmitting(true);
    try {
      const payload = {
        user_id: startForm.user_id,
        vehicle_id: startForm.vehicle_id,
        point_id: startForm.point_id,
        plan_id: startForm.plan_id,
        status: startForm.session_type,
        start_time: startForm.start_time,
        ...(startForm.session_type === 'completed'
          ? {
              end_time: startForm.end_time,
              energy_consumed_kwh: parseFloat(startForm.energy_consumed_kwh),
            }
          : {
              energy_consumed_kwh: 0.0,
            }),
      };

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to start session');

      setToast({
        type: 'success',
        message: json.message || 'Session created successfully.',
      });
      setStartModalOpen(false);
      fetchLookups();
      fetchSessions();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setStartSubmitting(false);
    }
  };

  const handleOpenComplete = (session) => {
    setCompletingSession(session);
    const now = new Date();
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    setCompleteForm({
      energy_consumed_kwh: session.energy_consumed_kwh > 0 ? String(session.energy_consumed_kwh) : '15.00',
      end_time: localNow,
    });
    setCompleteErrors({});
    setCompleteModalOpen(true);
  };

  const handleCompleteSubmit = async (e) => {
    e.preventDefault();
    setCompleteErrors({});

    const kwh = parseFloat(completeForm.energy_consumed_kwh);
    if (isNaN(kwh) || kwh < 0) {
      setCompleteErrors({ energy_consumed_kwh: 'Please enter a valid non-negative kWh value' });
      return;
    }

    setCompleteSubmitting(true);
    try {
      const res = await fetch('/api/sessions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: completingSession.session_id,
          action: 'complete',
          energy_consumed_kwh: kwh,
          end_time: completeForm.end_time,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to complete session');

      setToast({
        type: 'success',
        message: json.message || `Session #${completingSession.session_id} completed.`,
      });
      setCompleteModalOpen(false);
      fetchLookups();
      fetchSessions();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setCompleteSubmitting(false);
    }
  };

  const handleOpenDelete = (session) => {
    setDeletingSession(session);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingSession) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/sessions?id=${deletingSession.session_id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete session');

      setToast({ type: 'success', message: 'Session deleted successfully' });
      setDeleteDialogOpen(false);
      fetchLookups();
      fetchSessions();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
      setDeleteDialogOpen(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatDuration = (minutes) => {
    if (minutes === null || minutes === undefined) return '—';
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const columns = [
    {
      header: 'Session',
      accessor: (row) => (
        <div>
          <span className="font-mono text-slate-800 font-bold block">#{row.session_id}</span>
          <span className="text-[10px] text-slate-400">
            {row.start_time?.split(' ')[0]}
          </span>
        </div>
      ),
      className: 'w-24',
    },
    {
      header: 'Driver & EV',
      accessor: (row) => (
        <div>
          <span className="font-bold text-slate-900 block">{row.user_name}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              {row.vehicle_number}
            </span>
            <span className="text-xs text-slate-500 font-medium">{row.vehicle_model}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Station & Charger',
      accessor: (row) => (
        <div>
          <span className="font-semibold text-slate-900 block">{row.station_name}</span>
          <span className="text-xs text-slate-500 block">
            Point #{row.point_id} &bull; {row.connector_type} ({Number(row.power_rating_kw).toFixed(0)} kW)
          </span>
        </div>
      ),
    },
    {
      header: 'Session Timing',
      accessor: (row) => (
        <div className="text-xs space-y-0.5">
          <div className="flex items-center gap-1 text-slate-700">
            <span className="text-slate-400 text-[10px] uppercase font-bold w-10">Start:</span>
            <span className="font-mono">{row.start_time?.slice(11, 16) || '—'}</span>
          </div>
          <div className="flex items-center gap-1 text-slate-700">
            <span className="text-slate-400 text-[10px] uppercase font-bold w-10">End:</span>
            <span className="font-mono">
              {row.end_time ? row.end_time.slice(11, 16) : <span className="text-amber-600 font-semibold italic">Ongoing</span>}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 pt-0.5 font-medium">
            Elapsed: <span className="font-semibold text-slate-800">{formatDuration(row.duration_minutes)}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Energy (kWh)',
      accessor: (row) => (
        <div className="text-right">
          <span className="font-mono font-bold text-slate-900 text-sm">
            {Number(row.energy_consumed_kwh).toFixed(2)}
          </span>
          <span className="text-[11px] text-slate-400 block">kWh</span>
        </div>
      ),
      className: 'text-right',
    },
    {
      header: 'Tariff Plan',
      accessor: (row) => (
        <div>
          <span className="font-semibold text-slate-800 text-xs block">{row.plan_name}</span>
          <span className="text-[11px] text-slate-400 font-mono">
            ₹{Number(row.rate_per_kwh).toFixed(2)} / kWh
          </span>
        </div>
      ),
    },
    {
      header: 'Computed Cost',
      accessor: (row) => (
        <div className="text-right">
          <span className="font-mono font-extrabold text-slate-900 block text-sm">
            {row.computed_cost !== null ? `₹${Number(row.computed_cost).toFixed(2)}` : '—'}
          </span>
          <span className="text-[10px] text-emerald-600 font-medium">fn_session_cost</span>
        </div>
      ),
      className: 'text-right',
    },
    {
      header: 'Status',
      accessor: (row) => (
        <div className="space-y-1">
          <div>
            <StatusBadge status={row.status} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold mr-1">Bill:</span>
            <StatusBadge status={row.payment_status} />
          </div>
        </div>
      ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          {row.status === 'ongoing' ? (
            <button
              onClick={() => handleOpenComplete(row)}
              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs transition-all flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
              Stop Session
            </button>
          ) : (
            row.payment_status === 'Pending' && (
              <Link
                href={`/payments?session_id=${row.session_id}`}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500 text-white hover:bg-amber-600 shadow-2xs transition-all flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Collect
              </Link>
            )
          )}
          {([7, 8, 9].includes(row.session_id)) ? (
            <span className="text-[10px] text-slate-400 font-semibold px-2 py-1 bg-slate-50 rounded border border-slate-200">
              Sample Record
            </span>
          ) : (
            <button
              onClick={() => handleOpenDelete(row)}
              className="p-1.5 text-xs font-semibold rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
              title={row.payment_status === 'Paid' ? 'Deletion blocked: payment attached' : 'Delete session'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      ),
      className: 'text-right',
    },
  ];

  // Estimated cost during modal completion
  const selectedPlan = tariffPlans.find((p) => String(p.plan_id) === String(startForm.plan_id));
  const completePlan = completingSession
    ? tariffPlans.find((p) => String(p.plan_id) === String(completingSession.plan_id))
    : null;
  const estimatedCost =
    completePlan && completeForm.energy_consumed_kwh
      ? (parseFloat(completeForm.energy_consumed_kwh) * Number(completePlan.rate_per_kwh)).toFixed(2)
      : '0.00';

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
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold mb-2">
            Module M5
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Charging Session Tracking</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            ACID transaction execution, row-locking hardware protection, and dynamic billing formula.
          </p>
        </div>

        <button
          onClick={handleOpenStart}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Start Charging Session
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="sessionStatusSelect" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              Session Status:
            </label>
            <select
              id="sessionStatusSelect"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500 text-slate-700 font-medium"
            >
              <option value="">All Sessions</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* User Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="sessionUserSelect" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              Driver:
            </label>
            <select
              id="sessionUserSelect"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500 text-slate-700 font-medium"
            >
              <option value="">All Drivers</option>
              {users.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Station Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="sessionStationSelect" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              Station:
            </label>
            <select
              id="sessionStationSelect"
              value={stationFilter}
              onChange={(e) => setStationFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500 text-slate-700 font-medium"
            >
              <option value="">All Stations</option>
              {stations.map((s) => (
                <option key={s.station_id} value={s.station_id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Filter: Unpaid Only */}
        <button
          onClick={() => setUnpaidOnlyFilter(!unpaidOnlyFilter)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
            unpaidOnlyFilter
              ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
              : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-amber-300'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${unpaidOnlyFilter ? 'bg-white' : 'bg-amber-500'}`} />
          <span>Unpaid Completed Sessions</span>
        </button>
      </div>

      {/* Main Sessions Table */}
      <DataTable
        columns={columns}
        data={sessions}
        loading={loading}
        keyField="session_id"
        emptyTitle="No charging sessions found"
        emptyDescription={
          unpaidOnlyFilter
            ? 'All completed charging sessions have been paid in full.'
            : 'No charging sessions matching your criteria.'
        }
        emptyActionLabel="Start Session"
        onEmptyAction={handleOpenStart}
      />

      {/* Start Session Modal */}
      <Modal
        isOpen={startModalOpen}
        onClose={() => setStartModalOpen(false)}
        title="Start / Record Charging Session"
        subtitle="Enforces 3NF vehicle ownership check, hardware row locking, and tariff binding."
      >
        <form onSubmit={handleStartSubmit} className="space-y-4">
          {/* Session Mode Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setStartForm({ ...startForm, session_type: 'ongoing' })}
              className={`py-2 rounded-lg transition-all ${
                startForm.session_type === 'ongoing'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Live Ongoing Session
            </button>
            <button
              type="button"
              onClick={() => setStartForm({ ...startForm, session_type: 'completed' })}
              className={`py-2 rounded-lg transition-all ${
                startForm.session_type === 'completed'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Historical Completed Log
            </button>
          </div>

          {/* User Selection */}
          <FormField
            label="1. EV Driver (User)"
            name="user_id"
            type="select"
            value={startForm.user_id}
            onChange={(e) => handleUserChange(e.target.value)}
            options={users.map((u) => ({
              label: `${u.name} (${u.email})`,
              value: u.user_id,
            }))}
            placeholder="Select a registered user"
            required
            error={startErrors.user_id}
          />

          {/* Vehicle Selection (Strictly filtered by selected user) */}
          <FormField
            label="2. Assigned Vehicle (Owner-Verified)"
            name="vehicle_id"
            type="select"
            value={startForm.vehicle_id}
            onChange={(e) => setStartForm({ ...startForm, vehicle_id: e.target.value })}
            options={userVehicles.map((v) => ({
              label: `${v.vehicle_number} — ${v.model} (${v.battery_capacity} kWh)`,
              value: v.vehicle_id,
            }))}
            placeholder={
              userVehicles.length === 0
                ? 'No vehicles registered for this user'
                : 'Select vehicle owned by driver'
            }
            required
            error={startErrors.vehicle_id}
            helpText="Integrity Rule: Only vehicles owned by the selected user are permitted (trg_session_bi)."
          />

          {/* Station Selection */}
          <FormField
            label="3. Charging Station Facility"
            name="station_id"
            type="select"
            value={startForm.station_id}
            onChange={(e) => handleStationChange(e.target.value)}
            options={stations.map((s) => ({
              label: `${s.name} (${s.location}) — [${s.status.toUpperCase()}]`,
              value: s.station_id,
            }))}
            placeholder="Select charging station"
            required
            error={startErrors.station_id}
          />

          {/* Charging Point Selection */}
          <FormField
            label="4. Target Charging Point (Row-Locked)"
            name="point_id"
            type="select"
            value={startForm.point_id}
            onChange={(e) => setStartForm({ ...startForm, point_id: e.target.value })}
            options={stationPoints.map((p) => ({
              label: `Point #${p.point_id} — ${p.connector_type} (${p.power_rating_kw} kW) [${p.status}]`,
              value: p.point_id,
            }))}
            placeholder={
              stationPoints.length === 0
                ? 'No available charging points at this station'
                : 'Select available charger stall'
            }
            required
            error={startErrors.point_id}
            helpText={
              startForm.session_type === 'ongoing'
                ? "Locked via SELECT ... FOR UPDATE. Status will immediately switch to 'in-use'."
                : "Point selected for completed record."
            }
          />

          {/* Tariff Plan Selection */}
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="5. Tariff Plan"
              name="plan_id"
              type="select"
              value={startForm.plan_id}
              onChange={(e) => setStartForm({ ...startForm, plan_id: e.target.value })}
              options={tariffPlans.map((tp) => ({
                label: `${tp.plan_name} (₹${tp.rate_per_kwh}/kWh)`,
                value: tp.plan_id,
              }))}
              placeholder="Select plan"
              required
              error={startErrors.plan_id}
            />

            <FormField
              label="Start Timestamp"
              name="start_time"
              type="datetime-local"
              value={startForm.start_time}
              onChange={(e) => setStartForm({ ...startForm, start_time: e.target.value })}
              required
              error={startErrors.start_time}
            />
          </div>

          {/* Conditional Fields for Completed Session */}
          {startForm.session_type === 'completed' && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <span className="text-xs font-bold text-slate-800 block">Completed Session Details</span>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="End Timestamp"
                  name="end_time"
                  type="datetime-local"
                  value={startForm.end_time}
                  onChange={(e) => setStartForm({ ...startForm, end_time: e.target.value })}
                  required
                  error={startErrors.end_time}
                />
                <FormField
                  label="Energy Consumed (kWh)"
                  name="energy_consumed_kwh"
                  type="number"
                  step="0.01"
                  min="0.00"
                  value={startForm.energy_consumed_kwh}
                  onChange={(e) => setStartForm({ ...startForm, energy_consumed_kwh: e.target.value })}
                  required
                  error={startErrors.energy_consumed_kwh}
                />
              </div>
            </div>
          )}

          {/* Plan Info preview */}
          {selectedPlan && (
            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
              <span className="font-medium">Active Tariff Rate:</span>
              <span className="font-mono font-bold">
                {selectedPlan.plan_name} @ ₹{Number(selectedPlan.rate_per_kwh).toFixed(2)}/kWh
              </span>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStartModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={startSubmitting || (startForm.session_type === 'ongoing' && stationPoints.length === 0)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {startSubmitting && (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {startForm.session_type === 'ongoing' ? 'Engage Charger & Start' : 'Record Completed Session'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Complete Session Modal */}
      <Modal
        isOpen={completeModalOpen}
        onClose={() => setCompleteModalOpen(false)}
        title="Complete Charging Session"
        subtitle={
          completingSession
            ? `Finalizing Session #${completingSession.session_id} for ${completingSession.user_name} (${completingSession.vehicle_number})`
            : ''
        }
      >
        <form onSubmit={handleCompleteSubmit} className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Station &amp; Charger:</span>
              <span className="font-semibold text-slate-900">
                {completingSession?.station_name} (Point #{completingSession?.point_id})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Session Start Time:</span>
              <span className="font-mono text-slate-800">{completingSession?.start_time}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Applied Tariff Plan:</span>
              <span className="font-mono font-semibold text-emerald-700">
                {completingSession?.plan_name} (₹{Number(completingSession?.rate_per_kwh).toFixed(2)}/kWh)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Session End Time"
              name="end_time"
              type="datetime-local"
              value={completeForm.end_time}
              onChange={(e) => setCompleteForm({ ...completeForm, end_time: e.target.value })}
              required
              error={completeErrors.end_time}
            />

            <FormField
              label="Final Energy Consumed (kWh)"
              name="energy_consumed_kwh"
              type="number"
              step="0.01"
              min="0.00"
              value={completeForm.energy_consumed_kwh}
              onChange={(e) => setCompleteForm({ ...completeForm, energy_consumed_kwh: e.target.value })}
              required
              error={completeErrors.energy_consumed_kwh}
            />
          </div>

          {/* Live Bill Estimation */}
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-emerald-900 block">Projected Billing Amount</span>
              <span className="text-[11px] text-emerald-700">
                Formula: {completeForm.energy_consumed_kwh || '0'} kWh &times; ₹{Number(completingSession?.rate_per_kwh || 0).toFixed(2)}
              </span>
            </div>
            <span className="font-mono text-lg font-black text-emerald-800">₹{estimatedCost}</span>
          </div>

          <p className="text-[11px] text-slate-400">
            Completing this session will update point #{completingSession?.point_id} status back to <strong>available</strong> inside an ACID transaction.
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCompleteModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={completeSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {completeSubmitting && (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Complete Session &amp; Release Charger
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
        title="Delete Charging Session"
        message={`Are you sure you want to delete session #${deletingSession?.session_id} (${deletingSession?.user_name}, ${deletingSession?.vehicle_number})? If ongoing, the associated charger will be returned to 'available'. Any payment associated with this session will be removed.`}
        confirmText="Confirm Delete"
      />
    </div>
  );
}
