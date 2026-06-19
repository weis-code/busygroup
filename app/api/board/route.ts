import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);

  // Daily: each seller's calls + sales vs goals today
  const daily = await sql`
    SELECT
      u.id, u.name,
      COALESCE(dt.call_goal, 0)::int AS call_goal,
      COALESCE(dt.sales_goal, 0)::int AS sales_goal,
      COALESCE(SUM(al.calls_made), 0)::int AS calls_today,
      COALESCE(SUM(al.contacts_reached), 0)::int AS contacts_today,
      COALESCE(COUNT(DISTINCT s.id), 0)::int AS sales_today
    FROM users u
    LEFT JOIN daily_targets dt ON dt.user_id = u.id AND dt.date = ${today}
    LEFT JOIN activity_logs al ON al.user_id = u.id AND al.date = ${today}
    LEFT JOIN sales s ON s.user_id = u.id AND s.date = ${today}
    WHERE u.role = 'SELLER'
    GROUP BY u.id, u.name, dt.call_goal, dt.sales_goal
    ORDER BY calls_today DESC, u.name
  `;

  // Monthly: each seller's sales + calls vs monthly targets
  const monthStart = today.slice(0, 7) + '-01';
  const monthly = await sql`
    SELECT
      u.id, u.name,
      COALESCE(SUM(al.calls_made), 0)::int AS calls_month,
      COALESCE(COUNT(DISTINCT s.id), 0)::int AS sales_month,
      COALESCE(SUM(s.units), 0)::int AS units_month,
      COALESCE(
        (SELECT SUM(tg.unit_goal) FROM targets tg
         JOIN pay_periods pp ON pp.id = tg.period_id
         WHERE tg.user_id = u.id
           AND pp.start_date <= ${today}::date
           AND pp.end_date >= ${today}::date), 0
      )::int AS unit_goal_month
    FROM users u
    LEFT JOIN activity_logs al ON al.user_id = u.id AND al.date >= ${monthStart}
    LEFT JOIN sales s ON s.user_id = u.id AND s.date >= ${monthStart}
    WHERE u.role = 'SELLER'
    GROUP BY u.id, u.name
    ORDER BY sales_month DESC, u.name
  `;

  return NextResponse.json({ daily, monthly, today });
}
