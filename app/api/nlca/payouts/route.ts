import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

async function ensureNlcaTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS nlca_managers (
      id         SERIAL PRIMARY KEY,
      user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      email      TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS nlca_creators (
      id            SERIAL PRIMARY KEY,
      name          TEXT NOT NULL,
      manager_id    INTEGER REFERENCES nlca_managers(id) ON DELETE SET NULL,
      tiktok_handle TEXT,
      notes         TEXT,
      is_active     BOOLEAN DEFAULT true,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS nlca_monthly_figures (
      id                      SERIAL PRIMARY KEY,
      creator_id              INTEGER REFERENCES nlca_creators(id) ON DELETE CASCADE,
      month                   DATE NOT NULL,
      rank_up_usd             NUMERIC(10,2) DEFAULT 0,
      activeness_usd          NUMERIC(10,2) DEFAULT 0,
      incremental_revenue_usd NUMERIC(10,2) DEFAULT 0,
      entered_by              UUID REFERENCES users(id),
      updated_at              TIMESTAMPTZ DEFAULT NOW(),
      created_at              TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(creator_id, month)
    )
  `;
}

async function getManagerId(userId: string): Promise<number | null> {
  const [row] = await sql`SELECT id FROM nlca_managers WHERE user_id = ${userId} LIMIT 1`;
  return row?.id ?? null;
}

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || (session.role !== 'ADMIN' && session.role !== 'NLCA_MANAGER')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureNlcaTables();

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
  const monthDate = `${month}-01`;

  if (session.role === 'NLCA_MANAGER') {
    const managerId = await getManagerId(session.id);
    if (!managerId) return NextResponse.json({ creators: [], manager_payout: 0, visible_revenue: 0 });

    const creators = await sql`
      SELECT c.id AS creator_id, c.name AS creator_name,
             COALESCE(f.rank_up_usd, 0) AS rank_up_usd,
             COALESCE(f.activeness_usd, 0) AS activeness_usd,
             COALESCE(f.rank_up_usd, 0) + COALESCE(f.activeness_usd, 0) AS creator_payout
      FROM nlca_creators c
      LEFT JOIN nlca_monthly_figures f ON f.creator_id = c.id AND f.month = ${monthDate}::date
      WHERE c.manager_id = ${managerId} AND c.is_active = true
      ORDER BY c.name ASC
    `;

    const totalBase = creators.reduce((s, r) => s + Number(r.creator_payout ?? 0), 0);
    return NextResponse.json({
      creators,
      manager_payout: totalBase * 0.05,
      visible_revenue: totalBase,
    });
  }

  // ADMIN: full picture
  const creators = await sql`
    SELECT c.id AS creator_id, c.name AS creator_name,
           m.id AS manager_id, m.name AS manager_name,
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

  const managerPayouts = await sql`
    SELECT m.id AS manager_id, m.name AS manager_name,
           COUNT(DISTINCT c.id)::int AS creator_count,
           COALESCE(SUM(COALESCE(f.rank_up_usd, 0) + COALESCE(f.activeness_usd, 0)), 0) AS total_creator_base,
           COALESCE(SUM(COALESCE(f.rank_up_usd, 0) + COALESCE(f.activeness_usd, 0)) * 0.05, 0) AS manager_payout
    FROM nlca_managers m
    LEFT JOIN nlca_creators c ON c.manager_id = m.id AND c.is_active = true
    LEFT JOIN nlca_monthly_figures f ON f.creator_id = c.id AND f.month = ${monthDate}::date
    GROUP BY m.id, m.name
    ORDER BY m.name ASC
  `;

  const totalRevenue = creators.reduce(
    (s, r) => s + Number(r.rank_up_usd ?? 0) + Number(r.activeness_usd ?? 0) + Number(r.incremental_revenue_usd ?? 0),
    0
  );

  return NextResponse.json({ creators, manager_payouts: managerPayouts, total_revenue: totalRevenue });
}
