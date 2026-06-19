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
      COALESCE(dt.call_goal, 0)::int  AS call_goal,
      COALESCE(dt.sales_goal, 0)::int AS sales_goal,
      COALESCE(SUM(al.calls_made), 0)::int       AS calls_today,
      COALESCE(SUM(al.contacts_reached), 0)::int AS contacts_today,
      COALESCE(COUNT(DISTINCT s.id), 0)::int     AS sales_today
    FROM users u
    LEFT JOIN daily_targets dt ON dt.user_id = u.id AND dt.date = ${date}
    LEFT JOIN activity_logs al ON al.user_id = u.id AND al.date = ${date}
    LEFT JOIN sales s ON s.user_id = u.id AND s.date = ${date}
    WHERE u.role = 'SELLER'
    GROUP BY u.id, u.name, dt.call_goal, dt.sales_goal
    ORDER BY u.name
  `;

  return NextResponse.json({ rows, date });
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { user_id, date, call_goal, sales_goal } = await req.json();
  if (!user_id) return NextResponse.json({ error: 'user_id kræves' }, { status: 400 });

  const d = date || new Date().toISOString().slice(0, 10);

  const [row] = await sql`
    INSERT INTO daily_targets (user_id, date, call_goal, sales_goal)
    VALUES (${user_id}, ${d}, ${call_goal ?? 0}, ${sales_goal ?? 0})
    ON CONFLICT (user_id, date) DO UPDATE
      SET call_goal = EXCLUDED.call_goal, sales_goal = EXCLUDED.sales_goal
    RETURNING call_goal, sales_goal
  `;

  return NextResponse.json(row);
}
