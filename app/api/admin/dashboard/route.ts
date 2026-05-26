import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getPayPeriod(now: Date) {
  const day = now.getDate();
  let sy = now.getFullYear(), sm = now.getMonth();
  if (day < 21) { if (sm === 0) { sm = 11; sy--; } else sm--; }
  const ey = sm === 11 ? sy + 1 : sy;
  const em = (sm + 1) % 12;
  const pad = (n: number) => String(n).padStart(2, '0');
  return { start: `${sy}-${pad(sm + 1)}-21`, end: `${ey}-${pad(em + 1)}-20` };
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Kun admin' }, { status: 403 });
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const pp = getPayPeriod(now);

  // ── Kunder (interne) ──────────────────────────────────────────────────────
  const [mrrRow] = await sql`
    SELECT
      COALESCE(SUM(mrr), 0)    AS total_mrr,
      COUNT(*)                  AS active_count
    FROM customers WHERE active = true
  `;
  const churnRows = await sql`
    SELECT churn_risk, COUNT(*) AS cnt
    FROM customers WHERE active = true
    GROUP BY churn_risk
  `;
  const byRisk: Record<string, number> = { low: 0, medium: 0, high: 0 };
  for (const r of churnRows) byRisk[r.churn_risk as string] = Number(r.cnt);

  // Top 5 customers by MRR for the overview list
  const topCustomers = await sql`
    SELECT c.id, c.company, c.mrr, c.churn_risk, c.health_score,
      u.name AS assigned_name
    FROM customers c
    LEFT JOIN users u ON u.id = c.assigned_to
    WHERE c.active = true
    ORDER BY c.mrr DESC
    LIMIT 6
  `;

  // ── Ekstern salg (lønperiode) ─────────────────────────────────────────────
  const [extPeriodRow] = await sql`
    SELECT
      COUNT(*) AS deal_count,
      COALESCE(SUM(CASE c.revenue_model
        WHEN 'fixed'      THEN c.revenue_fixed
        WHEN 'percentage' THEN ROUND(d.deal_value * c.revenue_pct / 100)
        ELSE d.deal_value END), 0) AS house_revenue
    FROM sc_deals d
    JOIN sc_clients c ON c.id = d.client_id
    WHERE d.status = 'won' AND d.closed_at >= ${pp.start} AND d.closed_at <= ${pp.end}
  `;

  const [extTodayRow] = await sql`
    SELECT COUNT(*) AS deal_count
    FROM sc_deals d
    WHERE d.status = 'won' AND d.closed_at = ${today}
  `;

  // ── Sælger performance (periode) ──────────────────────────────────────────
  const ppKey = pp.start;
  const sellers = await sql`
    SELECT u.id, u.name,
      COUNT(CASE WHEN d.closed_at >= ${pp.start} AND d.closed_at <= ${pp.end} AND d.status = 'won' THEN 1 END) AS deals_count,
      COUNT(CASE WHEN d.closed_at = ${today} AND d.status = 'won' THEN 1 END) AS today_count,
      COALESCE(g.deals_goal, 0) AS deals_goal
    FROM users u
    LEFT JOIN sc_deals d ON d.salesperson_id = u.id
    LEFT JOIN sc_goals g ON g.user_id = u.id AND g.period = ${ppKey}
    WHERE u.role IN ('admin', 'seller') AND u.active = 1
    GROUP BY u.id, u.name, g.deals_goal
    ORDER BY deals_count DESC, u.name ASC
  `;

  // ── CRM pipeline ──────────────────────────────────────────────────────────
  const crmRows = await sql`
    SELECT status, COUNT(*) AS cnt, COALESCE(SUM(deal_value), 0) AS val
    FROM crm_leads
    GROUP BY status
  `;
  const crmByStatus: Record<string, number> = {};
  let crmPipelineValue = 0;
  for (const r of crmRows) {
    crmByStatus[r.status as string] = Number(r.cnt);
    if (!['won', 'lost'].includes(r.status as string)) {
      crmPipelineValue += Number(r.val);
    }
  }

  // ── Seneste ekstern salg ──────────────────────────────────────────────────
  const recentDeals = await sql`
    SELECT d.id, d.company_name, d.closed_at, d.created_at, d.deal_value,
      CASE c.revenue_model
        WHEN 'fixed'      THEN c.revenue_fixed
        WHEN 'percentage' THEN ROUND(d.deal_value * c.revenue_pct / 100)
        ELSE d.deal_value END AS house_revenue,
      u.name AS salesperson_name,
      c.name AS client_name, c.color AS client_color
    FROM sc_deals d
    LEFT JOIN users u ON u.id = d.salesperson_id
    LEFT JOIN sc_clients c ON c.id = d.client_id
    WHERE d.status = 'won' AND d.closed_at >= ${pp.start}
    ORDER BY d.closed_at DESC, d.created_at DESC
    LIMIT 10
  `;

  return NextResponse.json({
    payPeriod: pp,
    customers: {
      total_mrr:    Number(mrrRow.total_mrr),
      total_arr:    Number(mrrRow.total_mrr) * 12,
      active_count: Number(mrrRow.active_count),
      by_risk:      byRisk,
      top:          topCustomers,
    },
    external: {
      period_count:         Number(extPeriodRow.deal_count),
      period_house_revenue: Number(extPeriodRow.house_revenue),
      today_count:          Number(extTodayRow.deal_count),
    },
    sellers: sellers.map(s => ({
      id: s.id, name: s.name,
      deals_count: Number(s.deals_count),
      today_count: Number(s.today_count),
      deals_goal:  Number(s.deals_goal),
    })),
    crm: { by_status: crmByStatus, pipeline_value: crmPipelineValue },
    recentDeals,
  });
}
