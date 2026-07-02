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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || (session.role !== 'ADMIN' && session.role !== 'NLCA_MANAGER')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureNlcaTables();

  const { id } = await params;
  const creatorId = parseInt(id, 10);

  const [creator] = await sql`
    SELECT c.id, c.name, c.tiktok_handle, c.is_active, c.notes, c.created_at,
           m.id AS manager_id, m.name AS manager_name
    FROM nlca_creators c
    LEFT JOIN nlca_managers m ON m.id = c.manager_id
    WHERE c.id = ${creatorId}
    LIMIT 1
  `;
  if (!creator) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (session.role === 'NLCA_MANAGER') {
    const managerId = await getManagerId(session.id);
    if (creator.manager_id !== managerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const rawFigures = await sql`
    SELECT month, rank_up_usd, activeness_usd, incremental_revenue_usd, created_at, updated_at
    FROM nlca_monthly_figures
    WHERE creator_id = ${creatorId}
    ORDER BY month DESC
  `;

  const omitIncremental = (fig: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(fig).filter(([k]) => k !== 'incremental_revenue_usd'));

  const figures = session.role === 'ADMIN'
    ? rawFigures
    : rawFigures.map(fig => omitIncremental(fig as Record<string, unknown>));

  return NextResponse.json({ ...creator, figures });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureNlcaTables();

  const { id } = await params;
  const creatorId = parseInt(id, 10);
  const body = await req.json() as Record<string, unknown>;

  const fields: string[] = [];
  const values: unknown[] = [];

  if ('name' in body)          { fields.push('name = $' + (values.push(body.name)));          }
  if ('tiktok_handle' in body) { fields.push('tiktok_handle = $' + (values.push(body.tiktok_handle))); }
  if ('manager_id' in body)    { fields.push('manager_id = $' + (values.push(body.manager_id))); }
  if ('notes' in body)         { fields.push('notes = $' + (values.push(body.notes)));         }
  if ('is_active' in body)     { fields.push('is_active = $' + (values.push(body.is_active))); }

  if (fields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

  values.push(creatorId);
  const [updated] = await sql.unsafe(
    `UPDATE nlca_creators SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING id, name, tiktok_handle, manager_id, notes, is_active`,
    values as string[]
  );
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}
