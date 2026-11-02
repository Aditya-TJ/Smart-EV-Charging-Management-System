import './globals.css';
import Navbar from '@/components/Navbar';
import { cookies, headers } from 'next/headers';
import { validateSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Smart EV Charging & Energy Management System',
  description: 'DBMS Academic Project for PES University - MySQL 8.0 & Next.js App Router',
};

export default async function RootLayout({ children }) {
  const headersList = headers();
  const pathname = headersList.get('x-pathname') || '';

  // Server-side session verification for protected page routes
  if (pathname && pathname !== '/login' && !pathname.startsWith('/api/')) {
    const cookieStore = cookies();
    const token = cookieStore.get('admin_session_token')?.value;
    if (!token) {
      redirect('/login');
    }
    const session = await validateSession(token);
    if (!session) {
      redirect('/login');
    }
  }

  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen flex flex-col antialiased">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-slate-200/80 bg-white/70 py-8 text-center">
          <div className="max-w-7xl mx-auto px-4">
            <p className="font-bold text-slate-800 text-sm">
              Smart EV Charging &amp; Energy Management System
            </p>
            <p className="text-slate-400 text-xs mt-1">
              Powered by MySQL 8.0 and Next.js
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
