import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

// One-shot endpoint: creates Meridian CRM + ticket tables if they don't exist.
// Safe to call multiple times (all statements are CREATE IF NOT EXISTS).
export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const results: string[] = [];

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS meridian_pipeline_stages (
        id          SERIAL PRIMARY KEY,
        owner_id    TEXT NOT NULL,
        name        TEXT NOT NULL,
        color       TEXT NOT NULL DEFAULT '#4f8ef7',
        probability INTEGER DEFAULT 0,
        position    INTEGER NOT NULL DEFAULT 0,
        is_won      BOOLEAN DEFAULT false,
        is_lost     BOOLEAN DEFAULT false,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS meridian_stages_owner_idx ON meridian_pipeline_stages(owner_id)`;
    results.push('meridian_pipeline_stages ✓');
  } catch (e) { results.push(`meridian_pipeline_stages ERROR: ${String(e)}`); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS meridian_leads (
        id                  SERIAL PRIMARY KEY,
        owner_id            TEXT NOT NULL,
        company_name        TEXT NOT NULL,
        contact_name        TEXT,
        contact_title       TEXT,
        email               TEXT,
        phone               TEXT,
        linkedin            TEXT,
        website             TEXT,
        country             TEXT DEFAULT 'DK',
        industry            TEXT,
        stage_id            INTEGER REFERENCES meridian_pipeline_stages(id) ON DELETE SET NULL,
        products            JSONB DEFAULT '[]',
        deal_value_dkk      INTEGER DEFAULT 0,
        deal_type           TEXT DEFAULT 'recurring',
        expected_close_date DATE,
        probability         INTEGER DEFAULT 0,
        won_at              TIMESTAMPTZ,
        lost_at             TIMESTAMPTZ,
        lost_reason         TEXT,
        notes               TEXT,
        created_at          TIMESTAMPTZ DEFAULT NOW(),
        updated_at          TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS meridian_leads_owner_idx ON meridian_leads(owner_id)`;
    await sql`CREATE INDEX IF NOT EXISTS meridian_leads_stage_idx ON meridian_leads(stage_id)`;
    results.push('meridian_leads ✓');
  } catch (e) { results.push(`meridian_leads ERROR: ${String(e)}`); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS meridian_lead_activities (
        id               SERIAL PRIMARY KEY,
        owner_id         TEXT NOT NULL,
        lead_id          INTEGER REFERENCES meridian_leads(id) ON DELETE CASCADE,
        type             TEXT NOT NULL,
        direction        TEXT DEFAULT 'outbound',
        title            TEXT,
        body             TEXT,
        outcome          TEXT,
        next_action      TEXT,
        next_action_date DATE,
        occurred_at      TIMESTAMPTZ DEFAULT NOW(),
        created_at       TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS meridian_activities_owner_idx ON meridian_lead_activities(owner_id)`;
    await sql`CREATE INDEX IF NOT EXISTS meridian_activities_lead_idx  ON meridian_lead_activities(lead_id)`;
    results.push('meridian_lead_activities ✓');
  } catch (e) { results.push(`meridian_lead_activities ERROR: ${String(e)}`); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS meridian_tickets (
        id            SERIAL PRIMARY KEY,
        customer_id   INTEGER REFERENCES customers(id) ON DELETE SET NULL,
        customer_name TEXT NOT NULL,
        subject       TEXT NOT NULL,
        description   TEXT,
        type          TEXT DEFAULT 'general',
        status        TEXT DEFAULT 'open',
        priority      TEXT DEFAULT 'normal',
        assigned_to   UUID REFERENCES users(id) NULL,
        resolved_at   TIMESTAMPTZ NULL,
        resolved_by   UUID REFERENCES users(id) NULL,
        created_by    UUID REFERENCES users(id) NULL,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS meridian_tickets_status_idx   ON meridian_tickets(status)`;
    await sql`CREATE INDEX IF NOT EXISTS meridian_tickets_priority_idx ON meridian_tickets(priority)`;
    results.push('meridian_tickets ✓');
  } catch (e) { results.push(`meridian_tickets ERROR: ${String(e)}`); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS meridian_ticket_messages (
        id          SERIAL PRIMARY KEY,
        ticket_id   INTEGER REFERENCES meridian_tickets(id) ON DELETE CASCADE,
        author_id   UUID REFERENCES users(id) NULL,
        author_name TEXT NOT NULL,
        is_internal BOOLEAN DEFAULT false,
        body        TEXT NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS meridian_ticket_msgs_ticket_idx ON meridian_ticket_messages(ticket_id)`;
    results.push('meridian_ticket_messages ✓');
  } catch (e) { results.push(`meridian_ticket_messages ERROR: ${String(e)}`); }

  // Column migrations
  try {
    await sql`ALTER TABLE customer_products ADD COLUMN IF NOT EXISTS price_dkk INTEGER NOT NULL DEFAULT 0`;
    results.push('customer_products.price_dkk ✓');
  } catch (e) { results.push(`customer_products.price_dkk ERROR: ${String(e)}`); }

  return NextResponse.json({ results });
}
