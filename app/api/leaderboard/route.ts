import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get('filter') ?? 'active_period';
  const customStart = searchParams.get('start');
  const customEnd = searchParams.get('end');

  let startDate: string;
  let endDate: string;

  if (filter === 'custom' && customStart && customEnd) {
    startDate = customStart;
    endDate = customEnd;
  } else if (filter === 'this_week') {
    const rows = await sql`SELECT date_trunc('week', CURRENT_DATE)::date::text AS s, (date_trunc('week', CURRENT_DATE) + INTERVAL '6 days')::date::text AS e`;
    startDate = rows[0].s;
    endDate = rows[0].e;
  } else if (filter === 'this_month') {
    const rows = await sql`SELECT date_trunc('month', CURRENT_DATE)::date::text AS s, (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date::text AS e`;
    startDate = rows[0].s;
    endDate = rows[0].e;
  } else {
    // active_period
    const [period] = await sql`
      SELECT start_date::text AS s, end_date::text AS e FROM pay_periods
      WHERE start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
      ORDER BY start_date DESC LIMIT 1
    `;
    if (!period) {
      const rows = await sql`SELECT date_trunc('month', CURRENT_DATE)::date::text AS s, (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date::text AS e`;
      startDate = rows[0].s;
      endDate = rows[0].e;
    } else {
      startDate = period.s;
      endDate = period.e;
    }
  }

  const rows = await sql`
    SELECT
      u.id, u.name,
      COALESCE(SUM(al.calls_made), 0)::int          AS total_calls,
      COALESCE(SUM(al.meetings_booked), 0)::int     AS total_booked,
      COALESCE(SUM(al.meetings_held), 0)::int       AS total_held,
      COALESCE(COUNT(DISTINCT s.id), 0)::int        AS total_sales,
      COALESCE(SUM(s.units), 0)::int                AS total_units,
      COALESCE(SUM(
        al.calls_made +
        al.contacts_reached * 2 +
        al.meetings_booked * 5 +
        al.meetings_held * 3
      ), 0)::int AS activity_score,
      COUNT(DISTINCT ts.task_id)::int               AS task_count
    FROM users u
    LEFT JOIN activity_logs al ON al.user_id = u.id
      AND al.date >= ${startDate} AND al.date <= ${endDate}
    LEFT JOIN sales s ON s.user_id = u.id
      AND s.date >= ${startDate} AND s.date <= ${endDate}
    LEFT JOIN task_sellers ts ON ts.user_id = u.id
    WHERE u.role = 'SELLER' AND u.is_active = TRUE
    GROUP BY u.id, u.name
    ORDER BY activity_score DESC, total_sales DESC
  `;

  return NextResponse.json({ rows, startDate, endDate });
}
