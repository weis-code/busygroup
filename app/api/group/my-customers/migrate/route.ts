import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await sql`
    CREATE TABLE IF NOT EXISTS owner_products (
      id         SERIAL PRIMARY KEY,
      owner_id   INTEGER NOT NULL,
      name       TEXT NOT NULL,
      price      NUMERIC(10,2) NOT NULL,
      type       TEXT NOT NULL DEFAULT 'onetime' CHECK (type IN ('onetime','mrr')),
      active     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS owner_customers (
      id           SERIAL PRIMARY KEY,
      owner_id     INTEGER NOT NULL,
      name         TEXT NOT NULL,
      company      TEXT,
      email        TEXT,
      phone        TEXT,
      product_id   INTEGER REFERENCES owner_products(id) ON DELETE SET NULL,
      amount       NUMERIC(10,2),
      type         TEXT NOT NULL DEFAULT 'onetime' CHECK (type IN ('onetime','mrr')),
      closed_date  DATE,
      notes        TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  return NextResponse.json({ ok: true });
}
