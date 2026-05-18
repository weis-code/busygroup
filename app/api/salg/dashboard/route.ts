import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const period = now.toISOString().slice(0, 7);

  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diff);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const [todayRow] = await sql`
    SELECT COUNT(*) AS count, COALESCE(SUM(deal_value), 0) AS revenue
    FROM sc_deals WHERE status = 'won' AND closed_at >= ${today}
  `;

  const [weekRow] = await sql`
    SELECT COUNT(*) AS count, COALESCE(SUM(deal_value), 0) AS revenue
    FROM sc_deals WHERE status = 'won' AND closed_at >= ${weekStartStr}
  `;

  const [monthRow] = await sql`
    SELECT COUNT(*) AS count, COALESCE(SUM(deal_value), 0) AS revenue
    FROM sc_deals WHERE status = 'won' AND closed_at LIKE ${period + '%'}
  `;

  const sellers = await sql`
    SELECT
      u.id, u.name,
      COUNT(d.id)              AS deals_count,
      COALESCE(SUM(d.deal_value), 0) AS revenue,
      COALESCE(g.revenue_goal, 0)    AS revenue_goal,
      COALESCE(g.deals_goal,   0)    AS deals_goal
    FROM users u
    LEFT JOIN sc_deals d
      ON d.salesperson_id = u.id AND d.status = 'won' AND d.closed_at LIKE ${period + '%'}
    LEFT JOIN sc_goals g
      ON g.user_id = u.id AND g.period = ${period}
    WHERE u.role IN ('admin', 'seller')
    GROUP BY u.id, u.name, g.revenue_goal, g.deals_goal
    ORDER BY revenue DESC
  `;

  const recent = await sql`
    SELECT d.id, d.company_name, d.deal_value, d.closed_at, d.status,
           u.name AS salesperson_name, p.name AS product_name, c.name AS client_name
    FROM sc_deals d
    LEFT JOIN users u       ON u.id = d.salesperson_id
    LEFT JOIN sc_products p ON p.id = d.product_id
    LEFT JOIN sc_clients  c ON c.id = d.client_id
    WHERE d.status = 'won'
    ORDER BY d.closed_at DESC, d.created_at DESC
    LIMIT 10
  `;

  return NextResponse.json({
    today:   { count: Number(todayRow.count),  revenue: Number(todayRow.revenue)  },
    week:    { count: Number(weekRow.count),   revenue: Number(weekRow.revenue)   },
    month:   { count: Number(monthRow.count),  revenue: Number(monthRow.revenue)  },
    sellers: sellers.map(s => ({
      id:           s.id,
      name:         s.name,
      deals_count:  Number(s.deals_count),
      revenue:      Number(s.revenue),
      revenue_goal: Number(s.revenue_goal),
      deals_goal:   Number(s.deals_goal),
    })),
    recent,
    period,
  });
}
