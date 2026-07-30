import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS finance_onetime_projects (
      id            SERIAL PRIMARY KEY,
      company_id    INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
      invoiced_date DATE,
      notes         TEXT,
      created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
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
    SELECT p.*, c.name AS company_name, c.color AS company_color, c.slug AS company_slug
    FROM finance_onetime_projects p
    JOIN companies c ON c.id = p.company_id
    ORDER BY p.invoiced_date DESC NULLS LAST, p.created_at DESC
  `;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureTable();

  const { company_id, name, amount, invoiced_date, notes } = await req.json();
  if (!company_id || !name?.trim() || amount == null) {
    return NextResponse.json({ error: 'company_id, name og amount kræves' }, { status: 400 });
  }

  const [row] = await sql`
    INSERT INTO finance_onetime_projects (company_id, name, amount, invoiced_date, notes, created_by)
    VALUES (${company_id}, ${name.trim()}, ${amount}, ${invoiced_date || null}, ${notes || null}, ${session.id})
    RETURNING *
  `;
  return NextResponse.json(row, { status: 201 });
}
