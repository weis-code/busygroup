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

  if (session.role === 'NLCA_MANAGER') {
    const managerId = await getManagerId(session.id);
    if (!managerId) return NextResponse.json([]);

    const rows = await sql`
      SELECT f.id, f.creator_id, f.month,
             COALESCE(f.rank_up_usd, 0) AS rank_up_usd,
             COALESCE(f.activeness_usd, 0) AS activeness_usd,
             c.name AS creator_name, c.manager_id,
             m.name AS manager_name
      FROM nlca_creators c
      LEFT JOIN nlca_monthly_figures f ON f.creator_id = c.id AND f.month = ${monthDate}::date
      LEFT JOIN nlca_managers m ON m.id = c.manager_id
      WHERE c.manager_id = ${managerId} AND c.is_active = true
      ORDER BY c.name ASC
    `;
    return NextResponse.json(rows);
  }

  const rows = await sql`
    SELECT f.id, f.creator_id, f.month,
           COALESCE(f.rank_up_usd, 0) AS rank_up_usd,
           COALESCE(f.activeness_usd, 0) AS activeness_usd,
           COALESCE(f.incremental_revenue_usd, 0) AS incremental_revenue_usd,
           c.name AS creator_name, c.manager_id,
           m.name AS manager_name
    FROM nlca_creators c
    LEFT JOIN nlca_monthly_figures f ON f.creator_id = c.id AND f.month = ${monthDate}::date
    LEFT JOIN nlca_managers m ON m.id = c.manager_id
    WHERE c.is_active = true
    ORDER BY c.name ASC
  `;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || (session.role !== 'ADMIN' && session.role !== 'NLCA_MANAGER')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as {
    creator_id: number;
    month: string;
    rank_up_usd?: number;
    activeness_usd?: number;
    incremental_revenue_usd?: number;
  };

  const { creator_id, month } = body;
  if (!creator_id || !month) {
    return NextResponse.json({ error: 'creator_id and month required' }, { status: 400 });
  }

  if (session.role === 'NLCA_MANAGER') {
    if ('incremental_revenue_usd' in body) {
      return NextResponse.json({ error: 'Forbidden: cannot set incremental_revenue_usd' }, { status: 403 });
    }
    const managerId = await getManagerId(session.id);
    const [creator] = await sql`SELECT manager_id FROM nlca_creators WHERE id = ${creator_id} LIMIT 1`;
    if (!creator || creator.manager_id !== managerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const monthDate = `${month}-01`;
  const rankUp = body.rank_up_usd ?? null;
  const activeness = body.activeness_usd ?? null;
  const incRevenue = session.role === 'ADMIN' ? (body.incremental_revenue_usd ?? null) : null;

  const [row] = await sql`
    INSERT INTO nlca_monthly_figures (creator_id, month, rank_up_usd, activeness_usd, incremental_revenue_usd, entered_by)
    VALUES (${creator_id}, ${monthDate}::date, ${rankUp ?? 0}, ${activeness ?? 0}, ${incRevenue ?? 0}, ${session.id})
    ON CONFLICT (creator_id, month) DO UPDATE SET
      rank_up_usd             = CASE WHEN ${rankUp}::numeric IS NOT NULL THEN ${rankUp} ELSE nlca_monthly_figures.rank_up_usd END,
      activeness_usd          = CASE WHEN ${activeness}::numeric IS NOT NULL THEN ${activeness} ELSE nlca_monthly_figures.activeness_usd END,
      incremental_revenue_usd = CASE WHEN ${incRevenue}::numeric IS NOT NULL THEN ${incRevenue} ELSE nlca_monthly_figures.incremental_revenue_usd END,
      entered_by              = ${session.id},
      updated_at              = NOW()
    RETURNING id, creator_id, month, rank_up_usd, activeness_usd, incremental_revenue_usd, updated_at
  `;

  if (session.role !== 'ADMIN') {
    const safe = Object.fromEntries(
      Object.entries(row as Record<string, unknown>).filter(([k]) => k !== 'incremental_revenue_usd')
    );
    return NextResponse.json(safe);
  }

  return NextResponse.json(row);
}
