'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import Toast from '@/components/Toast';

function HistoryContent() {
  const searchParams = useSearchParams();
  const initialUserId = searchParams.get('user_id') || '';

  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [stations, setStations] = useState([]);

  // Filters
  const [selectedUser, setSelectedUser] = useState(initialUserId);
  const [selectedStation, setSelectedStation] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [sqlPanelOpen, setSqlPanelOpen] = useState(false);

  // Fetch users & stations lookups
  const fetchLookups = async () => {
    try {
      const [uRes, sRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/stations'),
      ]);
      const [uJson, sJson] = await Promise.all([uRes.json(), sRes.json()]);
      if (uRes.ok) setUsers(uJson.data || []);
      if (sRes.ok) setStations(sJson.data || []);
    } catch {
      // Lookups handled gracefully
    }
  };

  // Fetch history from v_charging_history
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedUser) params.append('user_id', selectedUser);
      if (selectedStation) params.append('station_id', selectedStation);
      if (selectedStatus) params.append('status', selectedStatus);
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);

      const res = await fetch(`/api/history?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch charging history');

      setHistory(json.data || []);
      setSummary(json.summary || null);
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }, [selectedUser, selectedStation, selectedStatus, fromDate, toDate]);

  useEffect(() => {
    fetchLookups();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleResetFilters = () => {
    setSelectedUser('');
    setSelectedStation('');
    setSelectedStatus('');
    setFromDate('');
    setToDate('');
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
          <span className="text-[10px] text-slate-400 font-mono">
            {row.start_time ? String(row.start_time).slice(0, 10) : '—'}
          </span>
        </div>
      ),
      className: 'w-24',
    },
    {
      header: 'EV Driver & Vehicle',
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
          <span className="font-semibold text-slate-900 block text-xs">{row.station_name}</span>
          <span className="text-[11px] text-slate-500 block">
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
            <span className="font-mono">{row.start_time ? String(row.start_time).slice(11, 16) : '—'}</span>
          </div>
          <div className="flex items-center gap-1 text-slate-700">
            <span className="text-slate-400 text-[10px] uppercase font-bold w-10">End:</span>
            <span className="font-mono">
              {row.end_time ? String(row.end_time).slice(11, 16) : <span className="text-amber-600 font-semibold italic">Ongoing</span>}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Duration: <span className="font-semibold text-slate-800">{formatDuration(row.duration_minutes)}</span>
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
          <span className="text-[10px] text-slate-400 block font-normal">kWh</span>
        </div>
      ),
      className: 'text-right',
    },
    {
      header: 'Tariff Rate',
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
      header: 'Session Cost',
      accessor: (row) => {
        const amt = row.payment_amount !== null ? Number(row.payment_amount) : Number(row.computed_cost || 0);
        return (
          <div className="text-right">
            <span className="font-mono font-extrabold text-slate-900 block text-sm">
              ₹{amt.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 block">
              {row.payment_amount !== null ? `Receipt #${row.payment_id}` : 'Unpaid bill'}
            </span>
          </div>
        );
      },
      className: 'text-right',
    },
    {
      header: 'Cumulative Spent',
      accessor: (row) => (
        <div className="text-right">
          <span className="font-mono font-bold text-emerald-700 block text-sm">
            ₹{Number(row.running_total_spent || 0).toFixed(2)}
          </span>
          <span className="text-[10px] text-emerald-600 font-medium block">
            Window SUM()
          </span>
        </div>
      ),
      className: 'text-right',
    },
    {
      header: 'Status',
      accessor: (row) => (
        <div className="space-y-1">
          <div>
            <StatusBadge status={row.session_status} />
          </div>
          <div>
            <StatusBadge status={row.payment_status} />
          </div>
        </div>
      ),
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
            Module M7
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Charging History &amp; User Spending</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Querying database view <code>v_charging_history</code> with analytic window function running totals.
          </p>
        </div>

        {/* Toggle Collapsible SQL Concept Panel */}
        <button
          onClick={() => setSqlPanelOpen(!sqlPanelOpen)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-all self-start sm:self-auto"
        >
          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          <span>{sqlPanelOpen ? 'Hide DBMS SQL Panel' : 'View Underlying SQL'}</span>
        </button>
      </div>

      {/* Collapsible SQL Concept & Schema Panel */}
      {sqlPanelOpen && (
        <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl shadow-md border border-slate-800 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>DBMS Syllabus Concept: Unit 2 &amp; Unit 3 — Views &amp; Window Functions</span>
            </div>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-sans font-bold">
              MySQL 8.0 Live View
            </span>
          </div>

          <div className="space-y-2 text-[11px] leading-relaxed text-slate-300">
            <p className="font-sans text-xs text-slate-200">
              This module satisfies the Project PDF requirement: <em>&ldquo;Find a user&rsquo;s charging history and total amount spent&rdquo;</em> by querying view <code>v_charging_history</code> and evaluating an analytic window function:
            </p>
            <pre className="p-3 bg-slate-950 rounded-xl overflow-x-auto text-emerald-300 border border-slate-800 text-[11px]">
{`SELECT 
    h.session_id,
    h.user_name,
    h.vehicle_number,
    h.station_name,
    h.energy_consumed_kwh,
    h.payment_amount,
    h.payment_status,
    -- Analytic Window Function for Running Cumulative Spending per Driver
    SUM(COALESCE(h.payment_amount, 0.00)) OVER (
        PARTITION BY h.user_id 
        ORDER BY h.start_time ASC, h.session_id ASC
    ) AS running_total_spent
FROM v_charging_history h;`}
            </pre>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {summary.user ? `Driver: ${summary.user.name}` : 'Total Filtered Sessions'}
            </span>
            <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
              {summary.total_sessions}
            </span>
            <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
              {summary.completed_sessions} completed &bull; {summary.ongoing_sessions} ongoing
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Energy Consumed
            </span>
            <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
              {summary.total_energy_kwh.toFixed(2)} <span className="text-xs text-slate-400 font-normal">kWh</span>
            </span>
            <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
              Delivered across chargers
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {summary.user ? 'Total Amount Spent' : 'Total Revenue Settled'}
            </span>
            <span className="text-2xl font-black text-emerald-700 font-mono mt-1 block">
              ₹{summary.total_amount_spent.toFixed(2)}
            </span>
            <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
              Paid settlements
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Pending Unsettled
            </span>
            <span className="text-2xl font-black text-amber-600 font-mono mt-1 block">
              ₹{summary.total_amount_pending.toFixed(2)}
            </span>
            <span className="text-[11px] text-amber-700 font-medium mt-0.5 block">
              {summary.total_amount_pending > 0 ? 'Awaiting collection' : 'Zero outstanding balance'}
            </span>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Driver Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="driverSelect" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              EV Driver:
            </label>
            <select
              id="driverSelect"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500 text-slate-700 font-medium"
            >
              <option value="">All Drivers (System Log)</option>
              {users.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          {/* Station Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="historyStationSelect" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              Station:
            </label>
            <select
              id="historyStationSelect"
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
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

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="historyStatusSelect" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              Status:
            </label>
            <select
              id="historyStatusSelect"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500 text-slate-700 font-medium"
            >
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="ongoing">Ongoing</option>
            </select>
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 text-slate-700 font-medium"
            />
            <span className="text-xs font-semibold text-slate-600">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 text-slate-700 font-medium"
            />
          </div>
        </div>

        {/* Reset Button */}
        {(selectedUser || selectedStation || selectedStatus || fromDate || toDate) && (
          <button
            onClick={handleResetFilters}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors self-end md:self-auto"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Main Charging History Data Table */}
      <DataTable
        columns={columns}
        data={history}
        loading={loading}
        keyField="session_id"
        emptyTitle="No charging history found"
        emptyDescription={
          selectedUser
            ? "This driver has no recorded charging sessions matching your criteria."
            : "No charging sessions found matching the specified filters."
        }
      />
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
        </div>
      }
    >
      <HistoryContent />
    </Suspense>
  );
}
