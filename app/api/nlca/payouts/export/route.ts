import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

async function getManagerId(userId: string): Promise<number | null> {
  const [row] = await sql`SELECT id FROM nlca_managers WHERE user_id = ${userId} LIMIT 1`;
  return row?.id ?? null;
}

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || (session.role !== 'ADMIN' && session.role !== 'NLCA_MANAGER')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
  const monthDate = `${month}-01`;

  const lines: string[] = [];

  if (session.role === 'NLCA_MANAGER') {
    const managerId = await getManagerId(session.id);
    if (!managerId) {
      lines.push('Creator,Rank-up (USD),Activeness (USD),Creator Payout (USD)');
    } else {
      const rows = await sql`
        SELECT c.name AS creator_name,
               COALESCE(f.rank_up_usd, 0) AS rank_up_usd,
               COALESCE(f.activeness_usd, 0) AS activeness_usd,
               COALESCE(f.rank_up_usd, 0) + COALESCE(f.activeness_usd, 0) AS creator_payout
        FROM nlca_creators c
        LEFT JOIN nlca_monthly_figures f ON f.creator_id = c.id AND f.month = ${monthDate}::date
        WHERE c.manager_id = ${managerId} AND c.is_active = true
        ORDER BY c.name ASC
      `;
      lines.push('Creator,Rank-up (USD),Activeness (USD),Creator Payout (USD)');
      for (const r of rows) {
        lines.push(`"${r.creator_name}",${r.rank_up_usd},${r.activeness_usd},${r.creator_payout}`);
      }
      const totalBase = rows.reduce((s, r) => s + Number(r.creator_payout ?? 0), 0);
      lines.push(`Total,,,"${totalBase.toFixed(2)}"`);
      lines.push('');
      lines.push(`Min udbetaling (5%),,,${(totalBase * 0.05).toFixed(2)}`);
    }
  } else {
    const creators = await sql`
      SELECT c.name AS creator_name, m.name AS manager_name,
             COALESCE(f.rank_up_usd, 0) AS rank_up_usd,
             COALESCE(f.activeness_usd, 0) AS activeness_usd,
             COALESCE(f.incremental_revenue_usd, 0) AS incremental_revenue_usd,
             COALESCE(f.rank_up_usd, 0) + COALESCE(f.activeness_usd, 0) AS creator_payout
      FROM nlca_creators c
      LEFT JOIN nlca_managers m ON m.id = c.manager_id
      LEFT JOIN nlca_monthly_figures f ON f.creator_id = c.id AND f.month = ${monthDate}::date
      WHERE c.is_active = true
      ORDER BY c.name ASC
    `;

    lines.push('CREATOR UDBETALINGER');
    lines.push('Creator,Manager,Rank-up (USD),Activeness (USD),Incremental Revenue (USD),Creator Payout (USD)');
    for (const r of creators) {
      lines.push(`"${r.creator_name}","${r.manager_name ?? ''}",${r.rank_up_usd},${r.activeness_usd},${r.incremental_revenue_usd},${r.creator_payout}`);
    }
    const totalCreator = creators.reduce((s, r) => s + Number(r.creator_payout ?? 0), 0);
    lines.push(`Total,,,,,${totalCreator.toFixed(2)}`);
    lines.push('');

    const managers = await sql`
      SELECT m.name AS manager_name, COUNT(DISTINCT c.id)::int AS creator_count,
             COALESCE(SUM(COALESCE(f.rank_up_usd, 0) + COALESCE(f.activeness_usd, 0)), 0) AS total_base,
             COALESCE(SUM(COALESCE(f.rank_up_usd, 0) + COALESCE(f.activeness_usd, 0)) * 0.05, 0) AS manager_payout
      FROM nlca_managers m
      LEFT JOIN nlca_creators c ON c.manager_id = m.id AND c.is_active = true
      LEFT JOIN nlca_monthly_figures f ON f.creator_id = c.id AND f.month = ${monthDate}::date
      GROUP BY m.id, m.name
      ORDER BY m.name ASC
    `;

    lines.push('MANAGER UDBETALINGER');
    lines.push('Manager,Antal Creators,Samlet Creator-Beløb (USD),Manager Payout 5% (USD)');
    for (const m of managers) {
      lines.push(`"${m.manager_name}",${m.creator_count},${m.total_base},${m.manager_payout}`);
    }
    const totalMgr = managers.reduce((s, m) => s + Number(m.manager_payout ?? 0), 0);
    lines.push(`Total,,,"${totalMgr.toFixed(2)}"`);
  }

  const csv = lines.join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="nlca-payouts-${month}.csv"`,
    },
  });
}
