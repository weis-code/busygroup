import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);

  const [entry] = await sql`
    SELECT id, clocked_in_at, clocked_out_at
    FROM time_entries
    WHERE user_id = ${session.id} AND date = ${today}
  `;

  if (!entry?.clocked_in_at) {
    return NextResponse.json({ error: 'Ikke stemplet ind endnu i dag' }, { status: 400 });
  }
  if (entry.clocked_out_at) {
    return NextResponse.json({ error: 'Allerede stemplet ud i dag' }, { status: 400 });
  }

  const [updated] = await sql`
    UPDATE time_entries SET clocked_out_at = NOW()
    WHERE user_id = ${session.id} AND date = ${today}
    RETURNING id, date::text, clocked_in_at, clocked_out_at
  `;

  return NextResponse.json(updated);
}
