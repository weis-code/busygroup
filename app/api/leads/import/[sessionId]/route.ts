export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { sessionId: string } }) {
  try {
    const [session] = await sql`SELECT * FROM import_sessions WHERE id = ${params.sessionId}`;
    if (!session) return NextResponse.json({ error: 'Session ikke fundet' }, { status: 404 });
    return NextResponse.json(session);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
