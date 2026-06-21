import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const uid = session.id;

  // KPIs from activity_logs — last 7 days
  const [kpi] = await sql`
    SELECT
      COALESCE(SUM(calls_made), 0)::int        AS calls_7d,
      COALESCE(SUM(contacts_reached), 0)::int  AS contacts_7d,
      COALESCE(SUM(meetings_booked), 0)::int   AS booked_7d,
      COALESCE(SUM(meetings_held), 0)::int     AS held_7d
    FROM activity_logs
    WHERE user_id = ${uid}
      AND date >= CURRENT_DATE - INTERVAL '6 days'
  `;

  // Sales count last 7 days (for closing rate)
  const [salesKpi] = await sql`
    SELECT COUNT(*)::int AS sales_7d FROM sales
    WHERE user_id = ${uid}
      AND date >= CURRENT_DATE - INTERVAL '6 days'
      AND status != 'PENDING'
  `;

  // Daily calls — last 14 days
  const dailyCalls = await sql`
    SELECT date::text, COALESCE(SUM(calls_made), 0)::int AS calls
    FROM activity_logs
    WHERE user_id = ${uid}
      AND date >= CURRENT_DATE - INTERVAL '13 days'
    GROUP BY date
    ORDER BY date
  `;

  // Last 10 sales
  const recentSales = await sql`
    SELECT s.id, s.date::text, s.units, s.deal_size, s.status,
           t.name AS task_name, t.compensation_model,
           tp.name AS package_name
    FROM sales s
    JOIN tasks t ON t.id = s.task_id
    LEFT JOIN task_packages tp ON tp.id = s.package_id
    WHERE s.user_id = ${uid}
    ORDER BY s.created_at DESC
    LIMIT 10
  `;

  // Active pay period + targets
  const [activePeriod] = await sql`
    SELECT id, name, start_date::text, end_date::text
    FROM pay_periods
    WHERE start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
    ORDER BY start_date DESC
    LIMIT 1
  `;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let targets: any[] = [];
  if (activePeriod) {
    targets = await sql`
      SELECT
        tg.id, tg.unit_goal, tg.revenue_goal,
        t.name AS task_name, t.compensation_model, t.display_mode,
        COALESCE(COUNT(s.id), 0)::int        AS units_sold,
        COALESCE(SUM(s.deal_size), 0)::numeric AS amount_sold
      FROM targets tg
      JOIN tasks t ON t.id = tg.task_id
      LEFT JOIN sales s ON s.task_id = tg.task_id
        AND s.user_id = ${uid}
        AND s.date >= ${activePeriod.start_date}
        AND s.date <= ${activePeriod.end_date}
      WHERE tg.user_id = ${uid}
        AND tg.period_id = ${activePeriod.id}
      GROUP BY tg.id, tg.unit_goal, tg.revenue_goal, t.name, t.compensation_model, t.display_mode
    `;
  }

  return NextResponse.json({
    kpi: {
      calls_7d: Number(kpi.calls_7d),
      contacts_7d: Number(kpi.contacts_7d),
      booked_7d: Number(kpi.booked_7d),
      held_7d: Number(kpi.held_7d),
      sales_7d: Number(salesKpi.sales_7d),
    },
    dailyCalls,
    recentSales,
    activePeriod: activePeriod ?? null,
    targets,
  });
}
