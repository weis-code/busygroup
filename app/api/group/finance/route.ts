import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // MRR per company — from customer_products via customers
    let companyMrr: Record<string, unknown>[] = [];
    try {
      companyMrr = await sql`
        SELECT
          co.id,
          co.name,
          co.slug,
          co.color,
          co.logo_initials,
          co.ownership_pct,
          COALESCE(SUM(cp.price_dkk) FILTER (WHERE cp.status = 'active'), 0)::int  AS mrr,
          COUNT(DISTINCT cu.id) FILTER (WHERE cu.status = 'active')::int             AS active_customers,
          COUNT(DISTINCT cu.id) FILTER (WHERE cu.status = 'onboarding')::int         AS onboarding_customers,
          COUNT(DISTINCT cp.id) FILTER (WHERE cp.status = 'active')::int             AS active_subs
        FROM companies co
        LEFT JOIN customers cu  ON cu.company_id  = co.id
        LEFT JOIN customer_products cp ON cp.customer_id = cu.id
        WHERE co.slug != 'group'
        GROUP BY co.id
        ORDER BY mrr DESC, co.name
      `;
    } catch {
      // customer_products.price_dkk may not exist yet — fall back to customers.mrr
      companyMrr = await sql`
        SELECT
          co.id,
          co.name,
          co.slug,
          co.color,
          co.logo_initials,
          co.ownership_pct,
          COALESCE(SUM(cu.mrr) FILTER (WHERE cu.status = 'active'), 0)::int AS mrr,
          COUNT(cu.id) FILTER (WHERE cu.status = 'active')::int              AS active_customers,
          COUNT(cu.id) FILTER (WHERE cu.status = 'onboarding')::int          AS onboarding_customers,
          0::int                                                              AS active_subs
        FROM companies co
        LEFT JOIN customers cu ON cu.company_id = co.id
        WHERE co.slug != 'group'
        GROUP BY co.id
        ORDER BY mrr DESC, co.name
      `;
    }

    const totalMrr        = (companyMrr as {mrr: number}[]).reduce((s, c) => s + (Number(c.mrr) || 0), 0);
    const totalCustomers  = (companyMrr as {active_customers: number}[]).reduce((s, c) => s + (Number(c.active_customers) || 0), 0);
    const totalOnboarding = (companyMrr as {onboarding_customers: number}[]).reduce((s, c) => s + (Number(c.onboarding_customers) || 0), 0);

    // Previous month MRR for delta — best-effort
    let lastMonthMrr = 0;
    const lastMonthStart = new Date();
    lastMonthStart.setDate(1);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    const lastMonthStartStr = lastMonthStart.toISOString().slice(0, 10);

    try {
      const [lastRow] = await sql`
        SELECT COALESCE(SUM(cp.price_dkk), 0)::int AS mrr
        FROM customer_products cp
        JOIN customers cu ON cu.id = cp.customer_id
        JOIN companies co ON co.id = cu.company_id
        WHERE cp.status = 'active'
          AND cp.started_at < ${lastMonthStartStr}
          AND co.slug != 'group'
      `;
      lastMonthMrr = Number(lastRow?.mrr ?? 0);
    } catch { /* ignore */ }

    return NextResponse.json({
      totalMrr,
      lastMonthMrr,
      totalCustomers,
      totalOnboarding,
      companies: companyMrr,
    });
  } catch (err) {
    console.error('[Group] finance GET failed:', err);
    return NextResponse.json({ error: 'Database error', detail: String(err) }, { status: 500 });
  }
}
