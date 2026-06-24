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

  const companySlug = req.nextUrl.searchParams.get('company');

  if (companySlug) {
    const rows = await sql`
      SELECT me.*, c.name AS company_name, c.slug AS company_slug
      FROM mrr_entries me
      JOIN companies c ON c.id = me.company_id
      WHERE c.slug = ${companySlug}
      ORDER BY me.month DESC
      LIMIT 24
    `;
    return NextResponse.json(rows);
  }

  const rows = await sql`
    SELECT me.*, c.name AS company_name, c.slug AS company_slug, c.color AS company_color
    FROM mrr_entries me
    JOIN companies c ON c.id = me.company_id
    ORDER BY c.name, me.month DESC
  `;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureTables();

  const { company_id, month, mrr_amount } = await req.json();
  if (!company_id || !month || mrr_amount == null) {
    return NextResponse.json({ error: 'company_id, month og mrr_amount kræves' }, { status: 400 });
  }

  const monthDate = month.slice(0, 7) + '-01';

  const [row] = await sql`
    INSERT INTO mrr_entries (company_id, month, mrr_amount)
    VALUES (${company_id}, ${monthDate}::date, ${mrr_amount})
    ON CONFLICT (company_id, month)
    DO UPDATE SET mrr_amount = EXCLUDED.mrr_amount
    RETURNING *
  `;
  return NextResponse.json(row);
}
