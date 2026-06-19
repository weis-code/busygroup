import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const date = req.nextUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);

  const [target] = await sql`
    SELECT call_goal, sales_goal FROM daily_targets
    WHERE user_id = ${session.id} AND date = ${date}
  `;

  const [actual] = await sql`
    SELECT
      COALESCE(SUM(al.calls_made), 0)::int AS calls_today,
      COALESCE(SUM(al.contacts_reached), 0)::int AS contacts_today,
      COALESCE(SUM(al.meetings_booked), 0)::int AS booked_today,
      COALESCE(SUM(al.meetings_held), 0)::int AS held_today
    FROM activity_logs al
    WHERE al.user_id = ${session.id} AND al.date = ${date}
  `;

  const [salesActual] = await sql`
    SELECT COUNT(*)::int AS sales_today
    FROM sales
    WHERE user_id = ${session.id} AND date = ${date}
  `;

  return NextResponse.json({
    date,
    call_goal: target?.call_goal ?? 0,
    sales_goal: target?.sales_goal ?? 0,
    calls_today: actual.calls_today,
    contacts_today: actual.contacts_today,
    booked_today: actual.booked_today,
    held_today: actual.held_today,
    sales_today: salesActual.sales_today,
  });
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { date, call_goal, sales_goal } = await req.json();
  const d = date || new Date().toISOString().slice(0, 10);

  const [row] = await sql`
    INSERT INTO daily_targets (user_id, date, call_goal, sales_goal)
    VALUES (${session.id}, ${d}, ${call_goal ?? 0}, ${sales_goal ?? 0})
    ON CONFLICT (user_id, date) DO UPDATE
      SET call_goal = EXCLUDED.call_goal, sales_goal = EXCLUDED.sales_goal
    RETURNING call_goal, sales_goal
  `;

  return NextResponse.json(row);
}
