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
    CREATE TABLE IF NOT EXISTS crm_contacts (
      id          SERIAL PRIMARY KEY,
      owner_id    INTEGER REFERENCES users(id),
      name        TEXT NOT NULL,
      title       TEXT,
      company_name TEXT,
      email       TEXT,
      phone       TEXT,
      linkedin    TEXT,
      notes       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS crm_deals (
      id             SERIAL PRIMARY KEY,
      owner_id       INTEGER REFERENCES users(id),
      contact_id     INTEGER REFERENCES crm_contacts(id) ON DELETE SET NULL,
      title          TEXT NOT NULL,
      value          NUMERIC(12,2),
      stage          TEXT NOT NULL DEFAULT 'lead',
      status         TEXT NOT NULL DEFAULT 'open',
      expected_close DATE,
      notes          TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS crm_touchpoints (
      id                SERIAL PRIMARY KEY,
      owner_id          INTEGER REFERENCES users(id),
      deal_id           INTEGER REFERENCES crm_deals(id) ON DELETE CASCADE,
      contact_id        INTEGER REFERENCES crm_contacts(id) ON DELETE SET NULL,
      type              TEXT NOT NULL,
      direction         TEXT,
      title             TEXT,
      body              TEXT,
      outcome           TEXT,
      duration_minutes  INTEGER,
      next_action       TEXT,
      next_action_date  DATE,
      next_action_done  BOOLEAN NOT NULL DEFAULT FALSE,
      extra             JSONB NOT NULL DEFAULT '{}',
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS crm_touchpoints_deal_idx ON crm_touchpoints(deal_id)`;
  await sql`CREATE INDEX IF NOT EXISTS crm_touchpoints_contact_idx ON crm_touchpoints(contact_id)`;
  await sql`CREATE INDEX IF NOT EXISTS crm_touchpoints_owner_idx ON crm_touchpoints(owner_id)`;
  await sql`CREATE INDEX IF NOT EXISTS crm_touchpoints_next_action_date_idx ON crm_touchpoints(next_action_date) WHERE next_action_done = FALSE`;

  return NextResponse.json({ ok: true });
}
