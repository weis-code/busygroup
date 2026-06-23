import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);

  const [existing] = await sql`
    SELECT id, clocked_in_at FROM time_entries WHERE user_id = ${session.id} AND date = ${today}
  `;
  if (existing?.clocked_in_at) {
    return NextResponse.json({ error: 'Allerede stemplet ind i dag' }, { status: 400 });
  }

  const [entry] = await sql`
    INSERT INTO time_entries (user_id, date, clocked_in_at)
    VALUES (${session.id}, ${today}, NOW())
    ON CONFLICT (user_id, date) DO UPDATE SET clocked_in_at = NOW()
    RETURNING id, date::text, clocked_in_at, clocked_out_at
  `;

  return NextResponse.json(entry, { status: 201 });
}
