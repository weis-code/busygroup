import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Allow NLCA_MANAGER role in users table
  await sql.unsafe(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
  await sql.unsafe(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('ADMIN','MANAGER','SELLER','NLCA_MANAGER'))`);

  // Ensure NLCA company exists
  await sql`
    INSERT INTO companies (name, slug, type, color, logo_initials, ownership_pct, stripe_enabled)
    VALUES ('Next Level Creator Agency', 'nlca', 'creator_agency', '#06b6d4', 'NLCA', 100, false)
    ON CONFLICT (slug) DO NOTHING
  `;

  // NLCA managers table
  await sql`
    CREATE TABLE IF NOT EXISTS nlca_managers (
      id         SERIAL PRIMARY KEY,
      user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      email      TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // NLCA creators table
  await sql`
    CREATE TABLE IF NOT EXISTS nlca_creators (
      id           SERIAL PRIMARY KEY,
      name         TEXT NOT NULL,
      manager_id   INTEGER REFERENCES nlca_managers(id) ON DELETE SET NULL,
      tiktok_handle TEXT,
      notes        TEXT,
      is_active    BOOLEAN DEFAULT true,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // NLCA monthly figures table
  await sql`
    CREATE TABLE IF NOT EXISTS nlca_monthly_figures (
      id                       SERIAL PRIMARY KEY,
      creator_id               INTEGER REFERENCES nlca_creators(id) ON DELETE CASCADE,
      month                    DATE NOT NULL,
      rank_up_usd              NUMERIC(10,2) DEFAULT 0,
      activeness_usd           NUMERIC(10,2) DEFAULT 0,
      incremental_revenue_usd  NUMERIC(10,2) DEFAULT 0,
      entered_by               UUID REFERENCES users(id),
      updated_at               TIMESTAMPTZ DEFAULT NOW(),
      created_at               TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(creator_id, month)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS nlca_monthly_figures_creator_idx ON nlca_monthly_figures(creator_id)`;
  await sql`CREATE INDEX IF NOT EXISTS nlca_monthly_figures_month_idx ON nlca_monthly_figures(month)`;
  await sql`CREATE INDEX IF NOT EXISTS nlca_creators_manager_idx ON nlca_creators(manager_id)`;
  await sql`CREATE INDEX IF NOT EXISTS nlca_managers_user_idx ON nlca_managers(user_id)`;

  // Seed NLCA board if not exists
  const [nlcaCompany] = await sql`SELECT id FROM companies WHERE slug = 'nlca' LIMIT 1`;
  if (nlcaCompany) {
    const nlcaId = nlcaCompany.id as number;
    const [existingBoard] = await sql`SELECT id FROM kanban_boards WHERE company_id = ${nlcaId} AND owner_user_id IS NULL LIMIT 1`;
    if (!existingBoard) {
      const [board] = await sql`INSERT INTO kanban_boards (company_id, name) VALUES (${nlcaId}, 'NLCA Board') RETURNING id`;
      const colNames = ['To Do', 'In Progress', 'Review', 'Done'];
      for (let pos = 0; pos < colNames.length; pos++) {
        await sql`INSERT INTO kanban_columns (board_id, name, position) VALUES (${board.id as number}, ${colNames[pos]}, ${pos})`;
      }
    }
    const [existingChannel] = await sql`SELECT id FROM channels WHERE company_id = ${nlcaId} AND is_general = true LIMIT 1`;
    if (!existingChannel) {
      const [firstAdmin] = await sql`SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1`;
      await sql`INSERT INTO channels (company_id, name, description, is_general, created_by) VALUES (${nlcaId}, 'general', 'NLCA general kanal', true, ${firstAdmin?.id ?? null})`;
    }
  }

  return NextResponse.json({ ok: true });
}
