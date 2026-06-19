import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const date = req.nextUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);

  const [dt] = await sql`
    SELECT call_goal, sales_goal, calls_actual, contacts_actual, meetings_booked_actual, meetings_held_actual
    FROM daily_targets
    WHERE user_id = ${session.id} AND date = ${date}
  `;

  const [salesActual] = await sql`
    SELECT COUNT(*)::int AS sales_today
    FROM sales
    WHERE user_id = ${session.id} AND date = ${date}
  `;

  return NextResponse.json({
    date,
    call_goal: dt?.call_goal ?? 0,
    sales_goal: dt?.sales_goal ?? 0,
    calls_today: dt?.calls_actual ?? 0,
    contacts_today: dt?.contacts_actual ?? 0,
    booked_today: dt?.meetings_booked_actual ?? 0,
    held_today: dt?.meetings_held_actual ?? 0,
    sales_today: salesActual.sales_today,
  });
}
