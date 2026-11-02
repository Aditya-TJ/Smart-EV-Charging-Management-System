'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const NAV_ITEMS = [
  { name: 'Home', href: '/' },
  { name: 'Users', href: '/users' },
  { name: 'Vehicles', href: '/vehicles' },
  { name: 'Stations', href: '/stations' },
  { name: 'Points', href: '/points' },
  { name: 'Sessions', href: '/sessions' },
  { name: 'Payments', href: '/payments' },
  { name: 'History', href: '/history' },
  { name: 'Revenue', href: '/revenue' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isLoginPage = pathname === '/login';

  // Fetch authenticated admin identity when not on login page
  useEffect(() => {
    let isMounted = true;
    if (isLoginPage) {
      setAdmin(null);
      return;
    }

    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) throw new Error('Unauthenticated');
        return res.json();
      })
      .then((data) => {
        if (isMounted && data.admin) {
          setAdmin(data.admin);
        }
      })
      .catch(() => {
        if (isMounted) setAdmin(null);
      });

    return () => {
      isMounted = false;
    };
  }, [pathname, isLoginPage]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      window.location.href = '/login';
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo / Brand */}
          <Link href={isLoginPage ? '/login' : '/'} className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/25 group-hover:scale-105 transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="font-extrabold text-slate-900 tracking-tight text-base sm:text-lg flex items-center gap-1.5">
                <span>Smart EV</span>
                <span className="hidden sm:inline-block text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-800 border border-emerald-200">
                  MySQL 8.0
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">EV Charging &amp; Energy Management</p>
            </div>
          </Link>

          {/* When on Login page, show portal status and omit navigation links */}
          {isLoginPage ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Admin Portal</span>
              </span>
            </div>
          ) : (
            <>
              {/* Desktop Nav Links */}
              <nav className="hidden lg:flex items-center space-x-1">
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </nav>

              {/* Right Admin Controls & Status */}
              <div className="hidden sm:flex items-center gap-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Live</span>
                </div>

                {admin && (
                  <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold">
                      <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold uppercase">
                        {admin.name ? admin.name.charAt(0) : 'A'}
                      </div>
                      <span className="max-w-[130px] truncate" title={admin.name}>{admin.name}</span>
                    </div>

                    <button
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      title="Sign out of Administrator Portal"
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>{isLoggingOut ? 'Exiting...' : 'Logout'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile menu button */}
              <div className="lg:hidden flex items-center">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 focus:outline-none"
                  aria-label="Toggle navigation menu"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {mobileMenuOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                    )}
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {!isLoginPage && mobileMenuOpen && (
        <div className="lg:hidden border-b border-slate-200 bg-white/95 backdrop-blur px-4 pt-2 pb-4 space-y-1">
          {admin && (
            <div className="pb-2 mb-2 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold uppercase">
                  {admin.name ? admin.name.charAt(0) : 'A'}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">{admin.name}</p>
                  <p className="text-[10px] text-slate-500">{admin.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200"
              >
                {isLoggingOut ? 'Exiting...' : 'Logout'}
              </button>
            </div>
          )}

          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-xl text-sm font-semibold ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item.name}
              </Link>
            );
          })}
          <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 px-3">
            <span>Database: <strong className="text-slate-700">smart_ev</strong></span>
            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
