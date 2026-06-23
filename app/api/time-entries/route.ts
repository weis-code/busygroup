import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);

  if (session.role === 'SELLER') {
    const [entry] = await sql`
      SELECT id, date::text, clocked_in_at, clocked_out_at
      FROM time_entries
      WHERE user_id = ${session.id} AND date = ${today}
    `;
    return NextResponse.json({ entry: entry ?? null });
  }

  // Admin/manager: all sellers for today
  const entries = await sql`
    SELECT te.id, te.date::text, te.clocked_in_at, te.clocked_out_at,
           u.id AS user_id, u.name AS user_name, u.role
    FROM users u
    LEFT JOIN time_entries te ON te.user_id = u.id AND te.date = ${today}
    WHERE u.role = 'SELLER'
    ORDER BY u.name
  `;
  return NextResponse.json({ entries, date: today });
}
