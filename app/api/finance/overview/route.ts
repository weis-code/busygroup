import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS finance_settings (
      id               SERIAL PRIMARY KEY,
      company_id       INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      fixed_costs_monthly NUMERIC(14,2) NOT NULL DEFAULT 0,
      updated_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(company_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS mrr_entries (
      id         SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      month      DATE    NOT NULL,
      mrr_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(company_id, month)
    )
  `;
}

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureTables();

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';

  // NLS revenue this month (from sales table)
  const [nlsRevenue] = await sql`
    SELECT COALESCE(SUM(house_revenue), 0)::numeric AS amount
    FROM sales
    WHERE date >= ${monthStart}::date AND date <= ${today}::date
  `;

  // NLS revenue last 6 months
  const nlsChart = await sql`
    SELECT
      TO_CHAR(DATE_TRUNC('month', date), 'YYYY-MM') AS month,
      TO_CHAR(DATE_TRUNC('month', date), 'Mon')     AS label,
      COALESCE(SUM(house_revenue), 0)::numeric AS amount
    FROM sales
    WHERE date >= (DATE_TRUNC('month', NOW()) - INTERVAL '5 months')
    GROUP BY 1, 2
    ORDER BY 1
  `;

  // MRR entries this month
  const mrrNow = await sql`
    SELECT c.slug, c.name, c.color, c.logo_initials,
           COALESCE(me.mrr_amount, 0)::numeric AS mrr_amount
    FROM companies c
    LEFT JOIN mrr_entries me
      ON me.company_id = c.id AND me.month = ${monthStart}::date
    WHERE c.slug != 'group'
    ORDER BY c.name
  `;

  // MRR last 6 months per company
  const mrrChart = await sql`
    SELECT
      TO_CHAR(me.month, 'YYYY-MM') AS month,
      c.slug,
      me.mrr_amount::numeric AS amount
    FROM mrr_entries me
    JOIN companies c ON c.id = me.company_id
    WHERE me.month >= (DATE_TRUNC('month', NOW()) - INTERVAL '5 months')
      AND c.slug != 'group' AND c.slug != 'nls'
    ORDER BY me.month, c.slug
  `;

  // Fixed costs per company
  const fixedCosts = await sql`
    SELECT c.slug, COALESCE(fs.fixed_costs_monthly, 0)::numeric AS fixed_costs
    FROM companies c
    LEFT JOIN finance_settings fs ON fs.company_id = c.id
    WHERE c.slug != 'group'
  `;

  // Headcount (non-part-time users)
  const [{ headcount }] = await sql`
    SELECT COUNT(*)::int AS headcount
    FROM users
    WHERE (is_part_time = FALSE OR is_part_time IS NULL)
      AND role IN ('ADMIN', 'MANAGER', 'SELLER')
  `;

  // Build per-company data
  const costsMap: Record<string, number> = {};
  for (const r of fixedCosts) costsMap[r.slug] = Number(r.fixed_costs);

  const mrrMap: Record<string, number> = {};
  for (const r of mrrNow) mrrMap[r.slug] = Number(r.mrr_amount);

  const nlsRev = Number(nlsRevenue.amount);
  const totalMrr = Object.entries(mrrMap)
    .filter(([s]) => s !== 'nls')
    .reduce((acc, [, v]) => acc + v, 0);
  const totalRevenue = nlsRev + totalMrr;
  const totalFixedCosts = Object.values(costsMap).reduce((a, b) => a + b, 0);
  const ebitda = totalRevenue - totalFixedCosts;

  const companies = mrrNow.map(c => ({
    slug:      c.slug,
    name:      c.name,
    color:     c.color,
    initials:  c.logo_initials,
    revenue:   c.slug === 'nls' ? nlsRev : Number(c.mrr_amount),
    mrr:       c.slug === 'nls' ? null    : Number(c.mrr_amount),
    fixed_costs: costsMap[c.slug] ?? 0,
    ebitda:    (c.slug === 'nls' ? nlsRev : Number(c.mrr_amount)) - (costsMap[c.slug] ?? 0),
    type:      c.slug === 'nls' ? 'sales' : 'saas',
  }));

  // Build 6-month chart: get all months
  const monthSet = new Set<string>();
  for (const r of nlsChart) monthSet.add(r.month);
  for (const r of mrrChart) monthSet.add(r.month);
  const months = Array.from(monthSet).sort();

  const mrrByMonthSlug: Record<string, Record<string, number>> = {};
  for (const r of mrrChart) {
    (mrrByMonthSlug[r.month] ??= {})[r.slug] = Number(r.amount);
  }
  const nlsByMonth: Record<string, number> = {};
  for (const r of nlsChart) nlsByMonth[r.month] = Number(r.amount);

  const MONTH_LABELS: Record<string, string> = {
    '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'Maj', '06': 'Jun',
    '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Dec',
  };
  const chart = months.map(m => {
    const mm = mrrByMonthSlug[m] ?? {};
    const nls = nlsByMonth[m] ?? 0;
    const total = nls + Object.values(mm).reduce((a, b) => a + b, 0);
    return { month: m, label: MONTH_LABELS[m.slice(5)] ?? m, nls, ...mm, total };
  });

  return NextResponse.json({
    kpis: { revenue: totalRevenue, mrr: totalMrr, ebitda, headcount: Number(headcount) },
    companies,
    chart,
    breakEven: {
      totalFixedCosts,
      currentRevenue: totalRevenue,
      margin: ebitda,
      percentage: totalFixedCosts > 0 ? Math.round((totalRevenue / totalFixedCosts) * 100) : null,
    },
  });
}
