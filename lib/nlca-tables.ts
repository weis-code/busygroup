import sql from '@/lib/db';

export async function ensureNlcaTables() {
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
      country       TEXT,
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
  await sql`
    CREATE TABLE IF NOT EXISTS nlca_country_managers (
      id         SERIAL PRIMARY KEY,
      user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      email      TEXT,
      country    TEXT NOT NULL UNIQUE,
      pct        NUMERIC(5,2) NOT NULL DEFAULT 5.00,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS nlca_creators_manager_idx ON nlca_creators(manager_id)`;
  await sql`CREATE INDEX IF NOT EXISTS nlca_monthly_figures_creator_idx ON nlca_monthly_figures(creator_id)`;
  await sql`CREATE INDEX IF NOT EXISTS nlca_monthly_figures_month_idx ON nlca_monthly_figures(month)`;
}
