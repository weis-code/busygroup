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
  await sql`CREATE INDEX IF NOT EXISTS nlca_creators_manager_idx ON nlca_creators(manager_id)`;
  await sql`CREATE INDEX IF NOT EXISTS nlca_monthly_figures_creator_idx ON nlca_monthly_figures(creator_id)`;
  await sql`CREATE INDEX IF NOT EXISTS nlca_monthly_figures_month_idx ON nlca_monthly_figures(month)`;
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

  if (session.role === 'NLCA_MANAGER') {
    const managerId = await getManagerId(session.id);
    if (!managerId) return NextResponse.json([]);

    const creators = await sql`
      SELECT c.id, c.name, c.tiktok_handle, c.is_active, c.created_at,
             m.id AS manager_id, m.name AS manager_name
      FROM nlca_creators c
      LEFT JOIN nlca_managers m ON m.id = c.manager_id
      WHERE c.manager_id = ${managerId}
      ORDER BY c.name ASC
    `;
    return NextResponse.json(creators);
  }

  const creators = await sql`
    SELECT c.id, c.name, c.tiktok_handle, c.is_active, c.created_at,
           m.id AS manager_id, m.name AS manager_name
    FROM nlca_creators c
    LEFT JOIN nlca_managers m ON m.id = c.manager_id
    ORDER BY c.name ASC
  `;
  return NextResponse.json(creators);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureNlcaTables();

  const { name, tiktok_handle, manager_id, notes } = await req.json() as {
    name: string;
    tiktok_handle?: string;
    manager_id?: number;
    notes?: string;
  };
  if (!name) return NextResponse.json({ error: 'Navn kræves' }, { status: 400 });

  const [creator] = await sql`
    INSERT INTO nlca_creators (name, tiktok_handle, manager_id, notes)
    VALUES (${name}, ${tiktok_handle ?? null}, ${manager_id ?? null}, ${notes ?? null})
    RETURNING id, name, tiktok_handle, manager_id, notes, is_active, created_at
  `;
  return NextResponse.json(creator, { status: 201 });
}
