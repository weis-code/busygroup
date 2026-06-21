import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);

  const daily = await sql`
    SELECT
      u.id, u.name,
      COALESCE(dt.call_goal, 0)::int       AS call_goal,
      COALESCE(dt.sales_goal, 0)::int      AS sales_goal,
      COALESCE(dt.calls_actual, 0)::int    AS calls_today,
      COALESCE(dt.contacts_actual, 0)::int AS contacts_today,
      COALESCE(COUNT(DISTINCT s.id), 0)::int AS sales_today
    FROM users u
    LEFT JOIN daily_targets dt ON dt.user_id = u.id AND dt.date = ${today}
    LEFT JOIN sales s ON s.user_id = u.id AND s.date = ${today}
    WHERE u.role = 'SELLER'
    GROUP BY u.id, u.name, dt.call_goal, dt.sales_goal, dt.calls_actual, dt.contacts_actual
    ORDER BY sales_today DESC, calls_today DESC, u.name
  `;

  const monthStart = today.slice(0, 7) + '-01';
  const monthly = await sql`
    SELECT
      u.id, u.name,
      COALESCE(COUNT(DISTINCT s.id), 0)::int            AS sales_month,
      COALESCE(SUM(s.units), 0)::int                    AS units_month,
      COALESCE(SUM(dt.contacts_actual), 0)::int         AS contacts_month,
      COALESCE(
        (SELECT SUM(tg.unit_goal) FROM targets tg
         JOIN pay_periods pp ON pp.id = tg.period_id
         WHERE tg.user_id = u.id
           AND pp.start_date <= ${today}::date
           AND pp.end_date >= ${today}::date), 0
      )::int AS unit_goal_month
    FROM users u
    LEFT JOIN sales s ON s.user_id = u.id AND s.date >= ${monthStart}
    LEFT JOIN daily_targets dt ON dt.user_id = u.id AND dt.date >= ${monthStart}
    WHERE u.role = 'SELLER'
    GROUP BY u.id, u.name
    ORDER BY sales_month DESC, u.name
  `;

  // Per-task monthly breakdown with display_mode
  const tasksMonthly = await sql`
    SELECT
      t.id AS task_id, t.name AS task_name, t.display_mode,
      u.id AS seller_id, u.name AS seller_name,
      COALESCE(COUNT(s.id), 0)::int           AS sales_count,
      COALESCE(SUM(s.deal_size), 0)::numeric  AS amount_sold,
      COALESCE(
        (SELECT tg.unit_goal FROM targets tg
         JOIN pay_periods pp ON pp.id = tg.period_id
         WHERE tg.task_id = t.id AND tg.user_id = u.id
           AND pp.start_date <= ${today}::date AND pp.end_date >= ${today}::date
         LIMIT 1), NULL
      ) AS unit_goal,
      COALESCE(
        (SELECT tg.revenue_goal FROM targets tg
         JOIN pay_periods pp ON pp.id = tg.period_id
         WHERE tg.task_id = t.id AND tg.user_id = u.id
           AND pp.start_date <= ${today}::date AND pp.end_date >= ${today}::date
         LIMIT 1), NULL
      ) AS revenue_goal
    FROM tasks t
    JOIN task_sellers ts ON ts.task_id = t.id
    JOIN users u ON u.id = ts.user_id AND u.role = 'SELLER'
    LEFT JOIN sales s ON s.task_id = t.id AND s.user_id = u.id AND s.date >= ${monthStart}
    WHERE t.status = 'active'
    GROUP BY t.id, t.name, t.display_mode, u.id, u.name
    ORDER BY t.name, u.name
  `;

  // Most recent sale this month for notification detection
  const [latestSale] = await sql`
    SELECT s.id, u.name AS seller_name, s.created_at
    FROM sales s
    JOIN users u ON u.id = s.user_id
    WHERE s.date >= ${monthStart}
    ORDER BY s.created_at DESC
    LIMIT 1
  `;

  return NextResponse.json({ daily, monthly, tasksMonthly, today, latestSale: latestSale ?? null });
}
