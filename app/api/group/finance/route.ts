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
    // MRR per company from customers.mrr — the established revenue field
    const rows = await sql`
      SELECT
        co.id,
        co.name,
        co.slug,
        co.color,
        co.logo_initials,
        COALESCE(SUM(cu.mrr) FILTER (WHERE cu.status = 'active'), 0)::int   AS mrr,
        COUNT(cu.id) FILTER (WHERE cu.status = 'active')::int                AS active_customers,
        COUNT(cu.id) FILTER (WHERE cu.status = 'onboarding')::int            AS onboarding_customers
      FROM companies co
      LEFT JOIN customers cu ON cu.company_id = co.id
      WHERE co.slug != 'group'
      GROUP BY co.id, co.name, co.slug, co.color, co.logo_initials
      ORDER BY mrr DESC, co.name
    `;

    // Try to get ownership_pct — column may not exist on older DB instances
    const ownershipMap: Record<number, number> = {};
    try {
      const ownershipRows = await sql`SELECT id, ownership_pct FROM companies WHERE slug != 'group'`;
      for (const r of ownershipRows) {
        ownershipMap[Number(r.id)] = Number(r.ownership_pct ?? 100);
      }
    } catch { /* ownership_pct column not yet migrated — default to 100 */ }

    type CompanyRow = Record<string, unknown> & { ownership_pct: number };
    const companies: CompanyRow[] = (rows as Record<string, unknown>[]).map(r => ({
      ...r,
      ownership_pct: ownershipMap[Number(r.id)] ?? 100,
    }));

    const totalMrr        = companies.reduce((s, c) => s + Number(c.mrr ?? 0), 0);
    const totalCustomers  = companies.reduce((s, c) => s + Number(c.active_customers ?? 0), 0);
    const totalOnboarding = companies.reduce((s, c) => s + Number(c.onboarding_customers ?? 0), 0);

    return NextResponse.json({
      totalMrr,
      lastMonthMrr: 0,
      totalCustomers,
      totalOnboarding,
      companies,
    });
  } catch (err) {
    console.error('[Group] finance GET failed:', err);
    return NextResponse.json({ error: 'Database error', detail: String(err) }, { status: 500 });
  }
}
