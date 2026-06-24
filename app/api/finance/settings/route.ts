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

  const rows = await sql`
    SELECT fs.*, c.name AS company_name, c.slug AS company_slug, c.color AS company_color
    FROM finance_settings fs
    JOIN companies c ON c.id = fs.company_id
    ORDER BY c.name
  `;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureTables();

  const { company_id, fixed_costs_monthly } = await req.json();
  if (!company_id || fixed_costs_monthly == null) {
    return NextResponse.json({ error: 'company_id og fixed_costs_monthly kræves' }, { status: 400 });
  }

  const [row] = await sql`
    INSERT INTO finance_settings (company_id, fixed_costs_monthly, updated_at)
    VALUES (${company_id}, ${fixed_costs_monthly}, NOW())
    ON CONFLICT (company_id)
    DO UPDATE SET fixed_costs_monthly = EXCLUDED.fixed_costs_monthly, updated_at = NOW()
    RETURNING *
  `;
  return NextResponse.json(row);
}
