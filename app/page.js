'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const SYSTEM_MODULES = [
  {
    title: 'User Management',
    desc: 'Add, update, view and remove EV users.',
    href: '/users',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    title: 'Vehicle Management',
    desc: 'Manage vehicles and link them to registered users.',
    href: '/vehicles',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
      </svg>
    ),
  },
  {
    title: 'Station Management',
    desc: 'Maintain charging station details and operational status.',
    href: '/stations',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    title: 'Charging Points',
    desc: 'Manage charging points, connector types and availability.',
    href: '/points',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: 'Charging Sessions',
    desc: 'Start, complete and track charging sessions.',
    href: '/sessions',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Payment Management',
    desc: 'Record and manage payments for charging sessions.',
    href: '/payments',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    title: 'Charging History',
    desc: 'View past charging sessions and user-wise spending.',
    href: '/history',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: 'Revenue Analysis',
    desc: 'Analyze station revenue, energy consumption and session trends.',
    href: '/revenue',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 520 280"
      className="w-full h-auto max-w-[460px] drop-shadow-md select-none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="solarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
        <linearGradient id="carGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
        <linearGradient id="windshieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#0284c7" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="groundGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#065f46" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Ambient soft glow */}
      <circle cx="390" cy="140" r="110" fill="#10b981" fillOpacity="0.18" filter="url(#softGlow)" />

      {/* Ground hill */}
      <path d="M0 260 Q180 240 520 250 L520 280 L0 280 Z" fill="url(#groundGrad)" fillOpacity="0.5" />

      {/* Solar Canopy Roof Structure */}
      {/* Cantilever support post */}
      <path d="M420 70 L434 70 L434 250 L420 250 Z" fill="#e2e8f0" />
      <path d="M424 105 L360 62 L370 54 L434 97 Z" fill="#cbd5e1" />

      {/* Canopy roof slab */}
      <polygon points="310,50 495,26 478,70 292,94" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />

      {/* Solar Panels Grid */}
      <polygon points="315,53 490,30 474,68 298,91" fill="url(#solarGrad)" />
      {/* Solar cell divider lines */}
      <line x1="358" y1="47" x2="341" y2="86" stroke="#bae6fd" strokeWidth="1.5" strokeOpacity="0.85" />
      <line x1="402" y1="42" x2="385" y2="81" stroke="#bae6fd" strokeWidth="1.5" strokeOpacity="0.85" />
      <line x1="446" y1="36" x2="429" y2="75" stroke="#bae6fd" strokeWidth="1.5" strokeOpacity="0.85" />
      <line x1="306" y1="72" x2="482" y2="49" stroke="#bae6fd" strokeWidth="1.5" strokeOpacity="0.85" />

      {/* Charging Station Pedestal */}
      <rect x="450" y="130" width="44" height="120" rx="10" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
      <rect x="457" y="145" width="30" height="34" rx="6" fill="#10b981" />
      {/* Lightning bolt on screen */}
      <path d="M473 151 L467 161 H473 L471 171 L478 160 H472 Z" fill="#ffffff" />
      {/* Pedestal base */}
      <rect x="442" y="246" width="60" height="8" rx="3" fill="#94a3b8" />

      {/* Charging Cable looping from station to car */}
      <path
        d="M455 188 C430 220 420 255 350 242 C330 238 320 226 308 218"
        fill="none"
        stroke="#0f172a"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M455 188 C430 220 420 255 350 242 C330 238 320 226 308 218"
        fill="none"
        stroke="#34d399"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="5 3"
      />

      {/* Electric Car */}
      {/* Ground shadow */}
      <ellipse cx="230" cy="256" rx="135" ry="12" fill="#022c22" fillOpacity="0.45" />

      {/* Car Body Silhouette */}
      <path
        d="M105 220 C100 215 105 194 132 190 C160 186 182 158 215 154 C260 150 302 158 330 185 C352 194 358 212 352 230 C348 242 334 244 316 244 C311 226 288 213 265 218 C242 222 238 244 224 244 C205 244 196 244 172 244 C167 226 144 213 121 218 C108 221 104 238 100 241 Z"
        fill="url(#carGrad)"
        stroke="#cbd5e1"
        strokeWidth="1.5"
      />

      {/* Car Windows & Pillars */}
      <path d="M188 188 C202 165 225 159 262 158 C294 158 312 176 324 188 Z" fill="url(#windshieldGrad)" />
      <line x1="258" y1="158" x2="258" y2="188" stroke="#ffffff" strokeWidth="2.5" />

      {/* Front Headlight Accent */}
      <path d="M338 202 L350 207 L342 214 Z" fill="#6ee7b7" />
      {/* Door Seam & Handle */}
      <path d="M254 188 L250 238" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="230" y="200" width="14" height="3" rx="1.5" fill="#94a3b8" />

      {/* Charging Port Connector plugged into front fender */}
      <rect x="304" y="212" width="7" height="11" rx="2.5" fill="#10b981" />

      {/* Wheels */}
      {/* Rear Wheel */}
      <circle cx="146" cy="238" r="22" fill="#0f172a" />
      <circle cx="146" cy="238" r="15" fill="#1e293b" />
      <circle cx="146" cy="238" r="10" fill="#059669" />
      <circle cx="146" cy="238" r="5" fill="#34d399" />

      {/* Front Wheel */}
      <circle cx="290" cy="238" r="22" fill="#0f172a" />
      <circle cx="290" cy="238" r="15" fill="#1e293b" />
      <circle cx="290" cy="238" r="10" fill="#059669" />
      <circle cx="290" cy="238" r="5" fill="#34d399" />
    </svg>
  );
}

export default function HomePage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stats');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch database counts');
      setStats(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const statCards = [
    {
      label: 'Users',
      count: stats?.usersCount,
      href: '/users',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      label: 'Vehicles',
      count: stats?.vehiclesCount,
      href: '/vehicles',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
        </svg>
      ),
    },
    {
      label: 'Stations',
      count: stats?.stationsCount,
      href: '/stations',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: 'Charging Points',
      count: stats?.pointsCount,
      href: '/points',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      label: 'Sessions',
      count: stats?.sessionsCount,
      href: '/sessions',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      label: 'Payments',
      count: stats?.paymentsCount,
      href: '/payments',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-9">
      {/* Hero Section */}
      <section className="rounded-3xl bg-[#064e3b] text-white p-7 sm:p-9 lg:p-11 shadow-xl relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-8 border border-emerald-900/40">
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold tracking-wider mb-5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>EV CHARGING &amp; ENERGY MANAGEMENT</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-black tracking-tight leading-[1.18]">
            Smart EV Charging &amp; <br />
            <span className="text-emerald-400">Energy Management System</span>
          </h1>

          <p className="mt-4 text-emerald-100/90 text-sm sm:text-base leading-relaxed">
            A web-based system to manage EV users, vehicles, charging stations, sessions, payments and station revenue with a MySQL database.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-semibold border border-white/15">
              <svg className="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3V7M4 7c0-2 1.5-3 3.5-3h9c2 0 3.5 1 3.5 3M4 7c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3m-16 5c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3" />
              </svg>
              <span>MySQL 8.0</span>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold border border-emerald-500/40 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              <span>Live Database</span>
            </div>
          </div>
        </div>

        {/* Hero Vector Illustration */}
        <div className="relative z-10 w-full lg:w-auto flex justify-center lg:justify-end shrink-0">
          <HeroIllustration />
        </div>
      </section>

      {/* Database Overview */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Database Overview</h2>
            <p className="text-sm text-slate-500 mt-0.5">Live record counts from the database</p>
          </div>

          <button
            onClick={fetchStats}
            disabled={loading}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-sm font-semibold shadow-2xs hover:shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            <svg className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh Counts</span>
          </button>
        </div>

        {error ? (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between">
            <div>
              <p className="font-bold">Failed to load database counts</p>
              <p className="text-xs mt-0.5 text-rose-600">{error}</p>
            </div>
            <button
              onClick={fetchStats}
              className="px-3.5 py-1.5 text-xs font-semibold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {statCards.map((c) => (
              <Link
                key={c.label}
                href={c.href}
                className="p-5 rounded-2xl bg-white border border-slate-100 shadow-2xs hover:shadow-md hover:border-emerald-200 transition-all flex flex-col justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    {c.icon}
                  </div>
                  <span className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                    {c.label}
                  </span>
                </div>
                <div className="mt-4 text-3xl font-extrabold text-slate-900 group-hover:text-emerald-600 transition-colors">
                  {loading ? (
                    <div className="h-8 w-12 bg-slate-200 animate-pulse rounded-md" />
                  ) : (
                    c.count ?? 0
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* System Modules */}
      <section>
        <div className="mb-5">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">System Modules</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage all core operations of the EV charging system</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {SYSTEM_MODULES.map((m) => (
            <div
              key={m.title}
              className="p-6 rounded-2xl bg-white border border-slate-100 shadow-2xs hover:shadow-md hover:border-emerald-200 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                  {m.icon}
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">
                  {m.title}
                </h3>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                  {m.desc}
                </p>
              </div>

              <Link
                href={m.href}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-emerald-600 text-emerald-600 hover:bg-emerald-50 text-sm font-semibold transition-colors w-fit"
              >
                <span>Launch View</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
