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

  const today      = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';

  // NLS revenue this month
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

  // Meridian combined MRR from customer_products (all active products)
  const [meridianMrrRow] = await sql`
    SELECT COALESCE(SUM(cp.price_dkk), 0)::numeric AS mrr_amount
    FROM customer_products cp
    WHERE cp.status = 'active'
      AND cp.product_name IN ('AI Receptionist', 'Quorex', 'BusyReminder', 'Hjemmeside')
  `;
  const meridianMrr = Number(meridianMrrRow.mrr_amount);

  // MRR entries this month for non-group, non-nls, non-quorex, non-reminder companies
  const mrrNow = await sql`
    SELECT c.slug, c.name, c.color, c.logo_initials,
           COALESCE(me.mrr_amount, 0)::numeric AS mrr_amount
    FROM companies c
    LEFT JOIN mrr_entries me
      ON me.company_id = c.id AND me.month = ${monthStart}::date
    WHERE c.slug NOT IN ('group', 'nls', 'quorex', 'reminder')
    ORDER BY c.name
  `;

  // MRR last 6 months — merge quorex+reminder into meridian
  const mrrChart = await sql`
    SELECT
      TO_CHAR(me.month, 'YYYY-MM') AS month,
      CASE WHEN c.slug IN ('quorex', 'reminder') THEN 'meridian' ELSE c.slug END AS slug,
      SUM(me.mrr_amount)::numeric AS amount
    FROM mrr_entries me
    JOIN companies c ON c.id = me.company_id
    WHERE me.month >= (DATE_TRUNC('month', NOW()) - INTERVAL '5 months')
      AND c.slug NOT IN ('group', 'nls')
    GROUP BY 1, 2
    ORDER BY 1, 2
  `;

  // Fixed costs per company (exclude quorex/reminder — their costs roll into meridian)
  const fixedCosts = await sql`
    SELECT c.slug, COALESCE(fs.fixed_costs_monthly, 0)::numeric AS fixed_costs
    FROM companies c
    LEFT JOIN finance_settings fs ON fs.company_id = c.id
    WHERE c.slug NOT IN ('group', 'quorex', 'reminder')
  `;

  // One-time project revenue this month, per company (falls back to created_at
  // when no invoice date was set, so it still lands in a month)
  const onetimeNow = await sql`
    SELECT c.slug, COALESCE(SUM(p.amount), 0)::numeric AS amount
    FROM finance_onetime_projects p
    JOIN companies c ON c.id = p.company_id
    WHERE COALESCE(p.invoiced_date, p.created_at::date) >= ${monthStart}::date
      AND COALESCE(p.invoiced_date, p.created_at::date) <= ${today}::date
    GROUP BY c.slug
  `;
  const onetimeNowMap: Record<string, number> = {};
  for (const r of onetimeNow) onetimeNowMap[r.slug] = Number(r.amount);

  // One-time project revenue for the 6-month chart, per company
  const onetimeChart = await sql`
    SELECT
      TO_CHAR(DATE_TRUNC('month', COALESCE(p.invoiced_date, p.created_at::date)), 'YYYY-MM') AS month,
      c.slug,
      COALESCE(SUM(p.amount), 0)::numeric AS amount
    FROM finance_onetime_projects p
    JOIN companies c ON c.id = p.company_id
    WHERE COALESCE(p.invoiced_date, p.created_at::date) >= (DATE_TRUNC('month', NOW()) - INTERVAL '5 months')
    GROUP BY 1, 2
  `;
  const onetimeByMonthSlug: Record<string, Record<string, number>> = {};
  for (const r of onetimeChart) {
    (onetimeByMonthSlug[r.month] ??= {})[r.slug] = Number(r.amount);
  }

  // Headcount
  const [{ headcount }] = await sql`
    SELECT COUNT(*)::int AS headcount
    FROM users
    WHERE (is_part_time = FALSE OR is_part_time IS NULL)
      AND role IN ('ADMIN', 'MANAGER', 'SELLER')
      AND is_active = TRUE
  `;

  const costsMap: Record<string, number> = {};
  for (const r of fixedCosts) costsMap[r.slug] = Number(r.fixed_costs);

  const nlsRev = Number(nlsRevenue.amount) + (onetimeNowMap['nls'] ?? 0);

  // Build per-company data: use meridianMrr for meridian, mrr_entries for others
  const companies = mrrNow.map(c => {
    const recurring = c.slug === 'meridian' ? meridianMrr : Number(c.mrr_amount);
    const revenue = recurring + (onetimeNowMap[c.slug] ?? 0);
    return {
      slug:       c.slug,
      name:       c.name,
      subtitle:   c.slug === 'meridian' ? 'inkl. Quorex + BusyReminder' : null,
      color:      c.color,
      initials:   c.logo_initials,
      revenue,
      mrr:        revenue,
      fixed_costs: costsMap[c.slug] ?? 0,
      ebitda:     revenue - (costsMap[c.slug] ?? 0),
      type:       c.slug === 'nls' ? 'sales' : 'saas',
    };
  });

  const nlsCompany = {
    slug: 'nls', name: 'Next Level Sales', subtitle: null,
    color: '#4f8ef7', initials: 'NLS',
    revenue: nlsRev, mrr: null,
    fixed_costs: costsMap['nls'] ?? 0,
    ebitda: nlsRev - (costsMap['nls'] ?? 0),
    type: 'sales',
  };

  const allCompanies = [nlsCompany, ...companies];

  const saasRevenue = companies.reduce((s, c) => s + c.revenue, 0);
  const totalRevenue = nlsRev + saasRevenue;
  const totalFixedCosts = Object.values(costsMap).reduce((a, b) => a + b, 0);
  const ebitda = totalRevenue - totalFixedCosts;

  // Build 6-month chart
  const monthSet = new Set<string>();
  for (const r of nlsChart) monthSet.add(r.month);
  for (const r of mrrChart) monthSet.add(r.month);
  for (const m of Object.keys(onetimeByMonthSlug)) monthSet.add(m);
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
    const onetimeSlugs = onetimeByMonthSlug[m] ?? {};
    const mm: Record<string, number> = { ...(mrrByMonthSlug[m] ?? {}) };
    for (const [slug, amount] of Object.entries(onetimeSlugs)) {
      if (slug === 'nls') continue; // folded into `nls` below instead
      mm[slug] = (mm[slug] ?? 0) + amount;
    }
    const nls = (nlsByMonth[m] ?? 0) + (onetimeSlugs['nls'] ?? 0);
    const total = nls + Object.values(mm).reduce((a, b) => a + b, 0);
    return { month: m, label: MONTH_LABELS[m.slice(5)] ?? m, nls, ...mm, total };
  });

  return NextResponse.json({
    kpis: { revenue: totalRevenue, mrr: saasRevenue, ebitda, headcount: Number(headcount) },
    companies: allCompanies,
    chart,
    breakEven: {
      totalFixedCosts,
      currentRevenue: totalRevenue,
      margin: ebitda,
      percentage: totalFixedCosts > 0 ? Math.round((totalRevenue / totalFixedCosts) * 100) : null,
    },
  });
}
