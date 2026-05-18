import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Kun admin' }, { status: 403 });
  const period = new URL(req.url).searchParams.get('period') || new Date().toISOString().slice(0, 7);
  const goals = await sql`
    SELECT g.*, u.name AS user_name
    FROM sc_goals g
    JOIN users u ON u.id = g.user_id
    WHERE g.period = ${period}
    ORDER BY u.name ASC
  `;
  return NextResponse.json(goals);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Kun admin' }, { status: 403 });
  const { user_id, period, revenue_goal, deals_goal } = await req.json();
  if (!user_id || !period) return NextResponse.json({ error: 'user_id og period er påkrævet' }, { status: 400 });
  const id = randomUUID();
  await sql`
    INSERT INTO sc_goals (id, user_id, period, revenue_goal, deals_goal, created_at)
    VALUES (${id}, ${user_id}, ${period}, ${revenue_goal ?? 0}, ${deals_goal ?? 0}, ${new Date().toISOString()})
    ON CONFLICT (user_id, period) DO UPDATE SET
      revenue_goal = EXCLUDED.revenue_goal,
      deals_goal   = EXCLUDED.deals_goal
  `;
  const [goal] = await sql`
    SELECT g.*, u.name AS user_name
    FROM sc_goals g
    JOIN users u ON u.id = g.user_id
    WHERE g.user_id = ${user_id} AND g.period = ${period}
  `;
  return NextResponse.json(goal);
}
