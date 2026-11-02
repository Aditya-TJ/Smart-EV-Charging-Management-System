'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import Toast from '@/components/Toast';

function RevenueContent() {
  const [stationRevenue, setStationRevenue] = useState([]);
  const [stationRanking, setStationRanking] = useState([]);
  const [summary, setSummary] = useState(null);
  const [dataSource, setDataSource] = useState('v_station_revenue');

  // Date filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [sqlPanelOpen, setSqlPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('revenue'); // 'revenue' or 'ranking'

  const fetchRevenue = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);

      const res = await fetch(`/api/revenue?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch revenue analytics');

      setStationRevenue(json.station_revenue || []);
      setStationRanking(json.station_ranking || []);
      setSummary(json.summary || null);
      setDataSource(json.source || 'v_station_revenue');
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchRevenue();
  }, [fetchRevenue]);

  const handleApplyPreset = (preset) => {
    if (preset === 'all') {
      setFromDate('');
      setToDate('');
    } else if (preset === 'august_2026') {
      setFromDate('2026-08-01');
      setToDate('2026-08-31');
    }
  };

  const revenueColumns = [
    {
      header: 'Station Facility',
      accessor: (row) => (
        <div>
          <span className="font-bold text-slate-900 block">{row.station_name}</span>
          <span className="text-xs text-slate-400">{row.station_location}</span>
        </div>
      ),
    },
    {
      header: 'Facility Capacity',
      accessor: (row) => (
        <div className="text-xs space-y-0.5">
          <span className="font-semibold text-slate-700 block">
            {row.total_points} Charger{row.total_points === 1 ? '' : 's'}
          </span>
          <span className="text-[11px] text-slate-400">
            {row.total_slots} Planned Slots
          </span>
        </div>
      ),
    },
    {
      header: 'Operational Status',
      accessor: (row) => <StatusBadge status={row.station_status} />,
    },
    {
      header: 'Total Sessions',
      accessor: (row) => (
        <span className="font-mono font-semibold text-slate-800 text-sm">
          {row.session_count ?? 0}
        </span>
      ),
      className: 'text-center',
    },
    {
      header: 'Energy Dispensed',
      accessor: (row) => (
        <div className="text-right">
          <span className="font-mono font-bold text-slate-900 block text-sm">
            {Number(row.total_energy_kwh || 0).toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-400 block font-normal">kWh</span>
        </div>
      ),
      className: 'text-right',
    },
    {
      header: 'Collected Revenue',
      accessor: (row) => (
        <div className="text-right">
          <span className="font-mono font-black text-emerald-700 block text-base">
            ₹{Number(row.total_revenue || 0).toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-400 block">
            {Number(row.total_revenue || 0) > 0 ? 'Settled Receipts' : 'No Paid Revenue'}
          </span>
        </div>
      ),
      className: 'text-right',
    },
  ];

  const rankingColumns = [
    {
      header: 'Activity Rank',
      accessor: (row) => {
        const isGold = row.session_rank === 1;
        const isSilver = row.session_rank === 2;
        const isBronze = row.session_rank === 3;
        return (
          <div className="flex items-center gap-2">
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                isGold
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : isSilver
                  ? 'bg-slate-200 text-slate-800 border border-slate-300'
                  : isBronze
                  ? 'bg-orange-100 text-orange-900 border border-orange-300'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              #{row.session_rank}
            </span>
          </div>
        );
      },
      className: 'w-24',
    },
    {
      header: 'Station Facility',
      accessor: (row) => (
        <div>
          <span className="font-bold text-slate-900 block">{row.station_name}</span>
          <span className="text-xs text-slate-400">{row.location}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (row) => <StatusBadge status={row.station_status} />,
    },
    {
      header: 'Session Volume',
      accessor: (row) => (
        <div>
          <span className="font-mono font-black text-slate-900 text-base block">
            {row.session_count}
          </span>
          <span className="text-[11px] text-slate-400">
            session{row.session_count === 1 ? '' : 's'} recorded
          </span>
        </div>
      ),
    },
    {
      header: 'Energy Dispensed',
      accessor: (row) => (
        <div className="text-right">
          <span className="font-mono font-bold text-slate-800 block text-sm">
            {Number(row.total_energy_kwh || 0).toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-400 block">kWh</span>
        </div>
      ),
      className: 'text-right',
    },
    {
      header: 'Total Revenue',
      accessor: (row) => (
        <div className="text-right">
          <span className="font-mono font-bold text-slate-900 block text-sm">
            ₹{Number(row.total_revenue || 0).toFixed(2)}
          </span>
          <span className="text-[10px] text-emerald-600 font-medium block">Collected</span>
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
            Module M8
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Revenue &amp; Station Performance</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Station-level financial accounting, stored procedure <code>sp_station_revenue()</code>, and CTE session ranking.
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

      {/* Collapsible SQL Concept Panel */}
      {sqlPanelOpen && (
        <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl shadow-md border border-slate-800 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>DBMS Syllabus Concept: Unit 2 &amp; Unit 4 — Stored Procedures &amp; CTEs</span>
            </div>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-sans font-bold">
              Double-Counting Protection
            </span>
          </div>

          <div className="space-y-2 text-[11px] leading-relaxed text-slate-300 font-sans">
            <p>
              To satisfy the Project PDF requirement: <em>&ldquo;Total revenue generated by each charging station&rdquo;</em>, sessions and payments are pre-aggregated inside a derived table by <code>station_id</code> before joining <code>charging_point</code>. This mathematically guarantees zero fan-out or duplicated totals when a station hosts multiple chargers:
            </p>
            <pre className="p-3 bg-slate-950 rounded-xl overflow-x-auto text-emerald-300 border border-slate-800 text-[11px] font-mono">
{`-- Double-Counting Protected Derived Table (Used in v_station_revenue & sp_station_revenue)
SELECT 
    cs.station_id, cs.name, cs.location,
    COALESCE(s.session_count, 0) AS session_count,
    COALESCE(s.total_energy_kwh, 0.00) AS total_energy_kwh,
    COALESCE(s.total_revenue, 0.00) AS total_revenue
FROM charging_station cs
LEFT JOIN (
    SELECT 
        cp2.station_id,
        COUNT(csess.session_id) AS session_count,
        COALESCE(SUM(csess.energy_consumed_kwh), 0.00) AS total_energy_kwh,
        COALESCE(SUM(p.amount), 0.00) AS total_revenue
    FROM charging_point cp2
    INNER JOIN charging_session csess ON cp2.point_id = csess.point_id
    LEFT JOIN payment p ON csess.session_id = p.session_id
    GROUP BY cp2.station_id
) s ON cs.station_id = s.station_id;`}
            </pre>
          </div>
        </div>
      )}

      {/* Top Financial Summary Metrics */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Collected Revenue
            </span>
            <span className="text-2xl font-black text-emerald-700 font-mono mt-1 block">
              ₹{summary.total_revenue.toFixed(2)}
            </span>
            <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
              Paid settlements only
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Energy Delivered
            </span>
            <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
              {summary.total_energy_kwh.toFixed(2)} <span className="text-xs text-slate-400 font-normal">kWh</span>
            </span>
            <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
              Across all network points
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Charging Sessions
            </span>
            <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
              {summary.total_sessions}
            </span>
            <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
              In selected time window
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Average Revenue / Station
            </span>
            <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
              ₹{summary.average_revenue_per_station.toFixed(2)}
            </span>
            <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
              Across {summary.total_stations} facilities
            </span>
          </div>
        </div>
      )}

      {/* Date Range Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Active Source Badge */}
          <div className="flex items-center gap-2 pr-2 border-r border-slate-200">
            <span className="text-xs font-semibold text-slate-500">Query Source:</span>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono text-[11px] font-bold border border-slate-200">
              {dataSource === 'sp_station_revenue' ? 'CALL sp_station_revenue(?, ?)' : 'v_station_revenue'}
            </span>
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

          {/* Presets */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleApplyPreset('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                !fromDate && !toDate
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => handleApplyPreset('august_2026')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                fromDate === '2026-08-01' && toDate === '2026-08-31'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              August 2026 (Sample Data)
            </button>
          </div>
        </div>

        {(fromDate || toDate) && (
          <button
            onClick={() => {
              setFromDate('');
              setToDate('');
            }}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors self-end md:self-auto"
          >
            Clear Date Filter
          </button>
        )}
      </div>

      {/* Tabs: Table A (Revenue by Station) vs Table B (Stations Ranked by Sessions) */}
      <div className="border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('revenue')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'revenue'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Table 1: Revenue &amp; Energy by Station</span>
          </button>

          <button
            onClick={() => setActiveTab('ranking')}
            className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ml-4 ${
              activeTab === 'ranking'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Table 2: Stations Ranked by Session Count (CTE + DENSE_RANK)</span>
          </button>
        </div>
      </div>

      {/* Render Active Table */}
      {activeTab === 'revenue' ? (
        <DataTable
          columns={revenueColumns}
          data={stationRevenue}
          loading={loading}
          keyField="station_id"
          emptyTitle="No station revenue records found"
          emptyDescription="No revenue activity recorded for the specified date range."
        />
      ) : (
        <DataTable
          columns={rankingColumns}
          data={stationRanking}
          loading={loading}
          keyField="station_id"
          emptyTitle="No station ranking records found"
          emptyDescription="No activity records found to compute ranking."
        />
      )}
    </div>
  );
}

export default function RevenuePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
        </div>
      }
    >
      <RevenueContent />
    </Suspense>
  );
}
