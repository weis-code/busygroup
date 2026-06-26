import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Migrate owner_id columns from INTEGER to TEXT on existing tables (idempotent)
  for (const table of ['crm_contacts', 'crm_deals', 'crm_touchpoints']) {
    try {
      await sql.unsafe(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_owner_id_fkey`);
      await sql.unsafe(`ALTER TABLE ${table} ALTER COLUMN owner_id TYPE TEXT USING owner_id::TEXT`);
    } catch { /* table does not exist yet — will be created below */ }
  }

  await sql`
    CREATE TABLE IF NOT EXISTS crm_contacts (
      id           SERIAL PRIMARY KEY,
      owner_id     TEXT,
      name         TEXT NOT NULL,
      title        TEXT,
      company_name TEXT,
      email        TEXT,
      phone        TEXT,
      linkedin     TEXT,
      notes        TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS crm_deals (
      id             SERIAL PRIMARY KEY,
      owner_id       TEXT,
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
      id               SERIAL PRIMARY KEY,
      owner_id         TEXT,
      deal_id          INTEGER REFERENCES crm_deals(id) ON DELETE CASCADE,
      contact_id       INTEGER REFERENCES crm_contacts(id) ON DELETE SET NULL,
      type             TEXT NOT NULL,
      direction        TEXT,
      title            TEXT,
      body             TEXT,
      outcome          TEXT,
      duration_minutes INTEGER,
      next_action      TEXT,
      next_action_date DATE,
      next_action_done BOOLEAN NOT NULL DEFAULT FALSE,
      extra            JSONB NOT NULL DEFAULT '{}',
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS crm_touchpoints_deal_idx ON crm_touchpoints(deal_id)`;
  await sql`CREATE INDEX IF NOT EXISTS crm_touchpoints_contact_idx ON crm_touchpoints(contact_id)`;
  await sql`CREATE INDEX IF NOT EXISTS crm_touchpoints_owner_idx ON crm_touchpoints(owner_id)`;
  await sql`CREATE INDEX IF NOT EXISTS crm_touchpoints_next_action_date_idx ON crm_touchpoints(next_action_date) WHERE next_action_done = FALSE`;

  // Existing deal columns
  await sql`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS product TEXT`;
  await sql`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS prospect_name TEXT`;
  await sql`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS prospect_company TEXT`;
  await sql`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS prospect_phone TEXT`;
  await sql`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS prospect_email TEXT`;

  // New deal columns
  await sql`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'DK'`;
  await sql`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS company_id INTEGER`;
  await sql`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS won_at TIMESTAMPTZ`;
  await sql`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ`;
  await sql`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS lost_reason TEXT`;

  // New contact columns
  await sql`ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'DK'`;
  await sql`ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS industry TEXT`;
  await sql`ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS website TEXT`;

  // Products table (admin's own product catalogue)
  await sql`
    CREATE TABLE IF NOT EXISTS crm_products (
      id          SERIAL PRIMARY KEY,
      owner_id    TEXT NOT NULL,
      name        TEXT NOT NULL,
      price       NUMERIC(12,2),
      type        TEXT NOT NULL DEFAULT 'monthly',
      description TEXT,
      active      BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS crm_products_owner_idx ON crm_products(owner_id)`;

  // Deal ↔ Product join table
  await sql`
    CREATE TABLE IF NOT EXISTS crm_deal_products (
      id         SERIAL PRIMARY KEY,
      deal_id    INTEGER REFERENCES crm_deals(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES crm_products(id) ON DELETE SET NULL,
      name       TEXT NOT NULL,
      price      NUMERIC(12,2),
      type       TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS crm_deal_products_deal_idx ON crm_deal_products(deal_id)`;

  // Pipeline stages table
  await sql`
    CREATE TABLE IF NOT EXISTS crm_pipeline_stages (
      id          SERIAL PRIMARY KEY,
      owner_id    TEXT NOT NULL,
      key         TEXT NOT NULL,
      label       TEXT NOT NULL,
      color       TEXT NOT NULL DEFAULT 'var(--bl)',
      probability INTEGER NOT NULL DEFAULT 50,
      position    INTEGER NOT NULL DEFAULT 0,
      is_won      BOOLEAN NOT NULL DEFAULT FALSE,
      is_lost     BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(owner_id, key)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS crm_pipeline_stages_owner_idx ON crm_pipeline_stages(owner_id)`;

  // Seed default stages for this user if they don't have any
  const stageCount = await sql`
    SELECT COUNT(*)::int AS cnt FROM crm_pipeline_stages WHERE owner_id = ${session.id}
  `;
  if ((stageCount[0]?.cnt ?? 0) === 0) {
    await sql`
      INSERT INTO crm_pipeline_stages (owner_id, key, label, color, probability, position, is_won, is_lost)
      VALUES
        (${session.id}, 'lead',        'Lead',        'var(--t3)', 5,   0, false, false),
        (${session.id}, 'kontaktet',   'Kontaktet',   'var(--bl)', 20,  1, false, false),
        (${session.id}, 'demo',        'Demo',        'var(--pu)', 40,  2, false, false),
        (${session.id}, 'tilbud',      'Tilbud',      'var(--ye)', 65,  3, false, false),
        (${session.id}, 'forhandling', 'Forhandling', 'var(--or)', 80,  4, false, false),
        (${session.id}, 'vundet',      'Vundet',      'var(--gr)', 100, 5, true,  false),
        (${session.id}, 'tabt',        'Tabt',        'var(--re)', 0,   6, false, true)
      ON CONFLICT DO NOTHING
    `;
  }

  return NextResponse.json({ ok: true });
}
