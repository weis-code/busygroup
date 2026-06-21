import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rows = await sql`
    SELECT tg.id, tg.unit_goal, tg.revenue_goal,
           u.name AS seller_name, u.id AS user_id,
           t.name AS task_name, t.id AS task_id, t.display_mode,
           p.name AS period_name, p.id AS period_id,
           p.start_date::text, p.end_date::text,
           COALESCE(COUNT(s.id), 0)::int          AS actual_count,
           COALESCE(SUM(s.deal_size), 0)::numeric  AS actual_amount
    FROM targets tg
    JOIN users u ON u.id = tg.user_id
    JOIN tasks t ON t.id = tg.task_id
    JOIN pay_periods p ON p.id = tg.period_id
    LEFT JOIN sales s ON s.task_id = tg.task_id
      AND s.user_id = tg.user_id
      AND s.date >= p.start_date AND s.date <= p.end_date
    GROUP BY tg.id, tg.unit_goal, tg.revenue_goal,
             u.name, u.id, t.name, t.id, t.display_mode,
             p.name, p.id, p.start_date, p.end_date
    ORDER BY p.start_date DESC, u.name, t.name
  `;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { period_id, user_id, task_id, unit_goal, revenue_goal } = await req.json();
  if (!period_id || !user_id || !task_id) {
    return NextResponse.json({ error: 'Periode, sælger og opgave kræves' }, { status: 400 });
  }

  const [row] = await sql`
    INSERT INTO targets (period_id, user_id, task_id, unit_goal, revenue_goal)
    VALUES (${period_id}, ${user_id}, ${task_id}, ${unit_goal ?? null}, ${revenue_goal ?? null})
    ON CONFLICT (period_id, user_id, task_id) DO UPDATE
      SET unit_goal = EXCLUDED.unit_goal, revenue_goal = EXCLUDED.revenue_goal
    RETURNING id
  `;
  return NextResponse.json(row, { status: 201 });
}
