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
           t.name AS task_name, t.id AS task_id,
           p.name AS period_name, p.id AS period_id,
           p.start_date::text, p.end_date::text
    FROM targets tg
    JOIN users u ON u.id = tg.user_id
    JOIN tasks t ON t.id = tg.task_id
    JOIN pay_periods p ON p.id = tg.period_id
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
