import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const date = req.nextUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);

  const rows = await sql`
    SELECT
      u.id, u.name,
      COALESCE(dt.call_goal, 0)::int             AS call_goal,
      COALESCE(dt.sales_goal, 0)::int            AS sales_goal,
      COALESCE(dt.calls_actual, 0)::int          AS calls_actual,
      COALESCE(dt.contacts_actual, 0)::int       AS contacts_actual,
      COALESCE(dt.meetings_booked_actual, 0)::int AS meetings_booked_actual,
      COALESCE(dt.meetings_held_actual, 0)::int   AS meetings_held_actual,
      COALESCE(COUNT(DISTINCT s.id), 0)::int     AS sales_today,
      MAX(ab.type)                               AS absence_type
    FROM users u
    LEFT JOIN daily_targets dt ON dt.user_id = u.id AND dt.date = ${date}
    LEFT JOIN sales s ON s.user_id = u.id AND s.date = ${date}
    LEFT JOIN absences ab ON ab.user_id = u.id AND ab.status = 'APPROVED'
      AND ab.start_date <= ${date} AND ab.end_date >= ${date}
    WHERE u.role = 'SELLER' AND u.is_active = TRUE
    GROUP BY u.id, u.name, dt.call_goal, dt.sales_goal,
             dt.calls_actual, dt.contacts_actual, dt.meetings_booked_actual, dt.meetings_held_actual
    ORDER BY u.name
  `;

  return NextResponse.json({ rows, date });
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { user_id, date, call_goal, sales_goal, calls_actual, contacts_actual, meetings_booked_actual, meetings_held_actual } = body;
  if (!user_id) return NextResponse.json({ error: 'user_id kræves' }, { status: 400 });

  const d = date || new Date().toISOString().slice(0, 10);

  const [row] = await sql`
    INSERT INTO daily_targets (user_id, date, call_goal, sales_goal, calls_actual, contacts_actual, meetings_booked_actual, meetings_held_actual)
    VALUES (${user_id}, ${d}, ${call_goal ?? 0}, ${sales_goal ?? 0}, ${calls_actual ?? 0}, ${contacts_actual ?? 0}, ${meetings_booked_actual ?? 0}, ${meetings_held_actual ?? 0})
    ON CONFLICT (user_id, date) DO UPDATE SET
      call_goal = EXCLUDED.call_goal,
      sales_goal = EXCLUDED.sales_goal,
      calls_actual = EXCLUDED.calls_actual,
      contacts_actual = EXCLUDED.contacts_actual,
      meetings_booked_actual = EXCLUDED.meetings_booked_actual,
      meetings_held_actual = EXCLUDED.meetings_held_actual
    RETURNING call_goal, sales_goal, calls_actual, contacts_actual, meetings_booked_actual, meetings_held_actual
  `;

  return NextResponse.json(row);
}
