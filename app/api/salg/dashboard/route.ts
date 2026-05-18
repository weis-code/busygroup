import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const isAdmin = session.role === 'admin';
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const period = now.toISOString().slice(0, 7);
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diff);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const yearStart = `${now.getFullYear()}-01-01`;

  // Seller filter: only their own deals
  const sellerFilter = isAdmin ? sql`true` : sql`d.salesperson_id = ${session.id}`;

  const [todayRow] = await sql`
    SELECT COUNT(*) AS count,
      COALESCE(SUM(d.deal_value), 0) AS revenue,
      COALESCE(SUM(CASE c.revenue_model
        WHEN 'fixed'      THEN c.revenue_fixed
        WHEN 'percentage' THEN ROUND(d.deal_value * c.revenue_pct / 100)
        ELSE d.deal_value END), 0) AS house_revenue
    FROM sc_deals d JOIN sc_clients c ON c.id = d.client_id
    WHERE d.status = 'won' AND d.closed_at >= ${today} AND ${sellerFilter}
  `;

  const [weekRow] = await sql`
    SELECT COUNT(*) AS count,
      COALESCE(SUM(d.deal_value), 0) AS revenue,
      COALESCE(SUM(CASE c.revenue_model
        WHEN 'fixed'      THEN c.revenue_fixed
        WHEN 'percentage' THEN ROUND(d.deal_value * c.revenue_pct / 100)
        ELSE d.deal_value END), 0) AS house_revenue
    FROM sc_deals d JOIN sc_clients c ON c.id = d.client_id
    WHERE d.status = 'won' AND d.closed_at >= ${weekStartStr} AND ${sellerFilter}
  `;

  const [monthRow] = await sql`
    SELECT COUNT(*) AS count,
      COALESCE(SUM(d.deal_value), 0) AS revenue,
      COALESCE(SUM(CASE c.revenue_model
        WHEN 'fixed'      THEN c.revenue_fixed
        WHEN 'percentage' THEN ROUND(d.deal_value * c.revenue_pct / 100)
        ELSE d.deal_value END), 0) AS house_revenue
    FROM sc_deals d JOIN sc_clients c ON c.id = d.client_id
    WHERE d.status = 'won' AND d.closed_at LIKE ${period + '%'} AND ${sellerFilter}
  `;

  const [yearRow] = await sql`
    SELECT COUNT(*) AS count,
      COALESCE(SUM(d.deal_value), 0) AS revenue,
      COALESCE(SUM(CASE c.revenue_model
        WHEN 'fixed'      THEN c.revenue_fixed
        WHEN 'percentage' THEN ROUND(d.deal_value * c.revenue_pct / 100)
        ELSE d.deal_value END), 0) AS house_revenue
    FROM sc_deals d JOIN sc_clients c ON c.id = d.client_id
    WHERE d.status = 'won' AND d.closed_at >= ${yearStart} AND ${sellerFilter}
  `;

  // Last 6 months
  const months: { period: string; label: string; count: number; revenue: number; house_revenue: number }[] = [];
  const names = ['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ period: d.toISOString().slice(0, 7), label: names[d.getMonth()], count: 0, revenue: 0, house_revenue: 0 });
  }

  const monthlyRows = await sql`
    SELECT SUBSTR(d.closed_at, 1, 7) AS period,
      COUNT(*) AS count,
      COALESCE(SUM(d.deal_value), 0) AS revenue,
      COALESCE(SUM(CASE c.revenue_model
        WHEN 'fixed'      THEN c.revenue_fixed
        WHEN 'percentage' THEN ROUND(d.deal_value * c.revenue_pct / 100)
        ELSE d.deal_value END), 0) AS house_revenue
    FROM sc_deals d JOIN sc_clients c ON c.id = d.client_id
    WHERE d.status = 'won' AND d.closed_at >= ${months[0].period + '-01'} AND ${sellerFilter}
    GROUP BY SUBSTR(d.closed_at, 1, 7)
  `;
  for (const row of monthlyRows) {
    const m = months.find(x => x.period === row.period);
    if (m) { m.count = Number(row.count); m.revenue = Number(row.revenue); m.house_revenue = Number(row.house_revenue); }
  }

  // Per-opgave this month (admin only)
  const byOpgave = isAdmin ? await sql`
    SELECT c.id, c.name, c.color,
      COUNT(d.id) AS deals_count,
      COALESCE(SUM(d.deal_value), 0) AS revenue,
      COALESCE(SUM(CASE c.revenue_model
        WHEN 'fixed'      THEN c.revenue_fixed
        WHEN 'percentage' THEN ROUND(d.deal_value * c.revenue_pct / 100)
        ELSE d.deal_value END), 0) AS house_revenue
    FROM sc_clients c
    LEFT JOIN sc_deals d ON d.client_id = c.id AND d.status = 'won' AND d.closed_at LIKE ${period + '%'}
    GROUP BY c.id, c.name, c.color
    HAVING COUNT(d.id) > 0
    ORDER BY house_revenue DESC
  ` : [];

  // Sellers + goals (admin sees all, seller sees only themselves)
  const sellers = await sql`
    SELECT u.id, u.name,
      COUNT(d.id)                    AS deals_count,
      COALESCE(SUM(d.deal_value), 0) AS revenue,
      COALESCE(SUM(CASE c.revenue_model
        WHEN 'fixed'      THEN c.revenue_fixed
        WHEN 'percentage' THEN ROUND(d.deal_value * c.revenue_pct / 100)
        ELSE d.deal_value END), 0)   AS house_revenue,
      COALESCE(g.revenue_goal, 0)    AS revenue_goal,
      COALESCE(g.deals_goal,   0)    AS deals_goal
    FROM users u
    LEFT JOIN sc_deals d
      ON d.salesperson_id = u.id AND d.status = 'won' AND d.closed_at LIKE ${period + '%'}
    LEFT JOIN sc_clients c ON c.id = d.client_id
    LEFT JOIN sc_goals g ON g.user_id = u.id AND g.period = ${period}
    WHERE u.role IN ('admin', 'seller')
      AND ${isAdmin ? sql`true` : sql`u.id = ${session.id}`}
    GROUP BY u.id, u.name, g.revenue_goal, g.deals_goal
    ORDER BY deals_count DESC
  `;

  const recent = await sql`
    SELECT d.id, d.company_name, d.deal_value, d.closed_at, d.created_at,
      CASE c.revenue_model
        WHEN 'fixed'      THEN c.revenue_fixed
        WHEN 'percentage' THEN ROUND(d.deal_value * c.revenue_pct / 100)
        ELSE d.deal_value END AS house_revenue,
      u.name AS salesperson_name, p.name AS product_name,
      c.name AS client_name, c.color AS client_color
    FROM sc_deals d
    LEFT JOIN users u       ON u.id = d.salesperson_id
    LEFT JOIN sc_products p ON p.id = d.product_id
    LEFT JOIN sc_clients  c ON c.id = d.client_id
    WHERE d.status = 'won' AND ${sellerFilter}
    ORDER BY d.closed_at DESC, d.created_at DESC
    LIMIT 12
  `;

  return NextResponse.json({
    isAdmin,
    today:   { count: Number(todayRow.count),  revenue: Number(todayRow.revenue),  house_revenue: Number(todayRow.house_revenue)  },
    week:    { count: Number(weekRow.count),   revenue: Number(weekRow.revenue),   house_revenue: Number(weekRow.house_revenue)   },
    month:   { count: Number(monthRow.count),  revenue: Number(monthRow.revenue),  house_revenue: Number(monthRow.house_revenue)  },
    year:    { count: Number(yearRow.count),   revenue: Number(yearRow.revenue),   house_revenue: Number(yearRow.house_revenue)   },
    monthly: months,
    byOpgave: byOpgave.map(o => ({ id: o.id, name: o.name, color: o.color, deals_count: Number(o.deals_count), revenue: Number(o.revenue), house_revenue: Number(o.house_revenue) })),
    sellers: sellers.map(s => ({ id: s.id, name: s.name, deals_count: Number(s.deals_count), revenue: Number(s.revenue), house_revenue: Number(s.house_revenue), revenue_goal: Number(s.revenue_goal), deals_goal: Number(s.deals_goal) })),
    recent,
    period,
  });
}
