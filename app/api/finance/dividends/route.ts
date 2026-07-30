import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS finance_dividends (
      id                SERIAL PRIMARY KEY,
      source_company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      amount            NUMERIC(14,2) NOT NULL DEFAULT 0,
      received_date     DATE,
      notes             TEXT,
      created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureTable();

  const rows = await sql`
    SELECT d.*, c.name AS company_name, c.color AS company_color, c.slug AS company_slug, c.ownership_pct
    FROM finance_dividends d
    JOIN companies c ON c.id = d.source_company_id
    ORDER BY d.received_date DESC NULLS LAST, d.created_at DESC
  `;
  const normalized = rows.map(r => ({ ...r, ownership_pct: Number(r.ownership_pct) }));
  return NextResponse.json(normalized);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureTable();

  const { source_company_id, amount, received_date, notes } = await req.json();
  if (!source_company_id || amount == null) {
    return NextResponse.json({ error: 'source_company_id og amount kræves' }, { status: 400 });
  }

  const [row] = await sql`
    INSERT INTO finance_dividends (source_company_id, amount, received_date, notes, created_by)
    VALUES (${source_company_id}, ${amount}, ${received_date || null}, ${notes || null}, ${session.id})
    RETURNING *
  `;
  return NextResponse.json(row, { status: 201 });
}
