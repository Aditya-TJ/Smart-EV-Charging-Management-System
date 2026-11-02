import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAdminAuth(request);

  if (!auth.authenticated) {
    return NextResponse.json(
      { authenticated: false, admin: null },
      { status: 401 }
    );
  }

  return NextResponse.json({
    authenticated: true,
    admin: auth.admin,
  });
}
