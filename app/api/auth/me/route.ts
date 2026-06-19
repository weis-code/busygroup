import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ id: session.id, name: session.name, email: session.email, role: session.role });
}
