export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (!process.env.DATABASE_URL) {
    console.warn('[NLS] DATABASE_URL not set — skipping schema init');
    return;
  }

  const { default: sql } = await import('./lib/db');

  // Each section below runs in its own try/catch so one failing statement can't
  // silently block every section after it — this used to be one giant try block,
  // and a failure partway through left everything after it (including the HR/
  // recruitment tables) permanently uncreated on every boot with no visible error.

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'SELLER' CHECK (role IN ('ADMIN','MANAGER','SELLER','NLCA_MANAGER')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
  } catch (err) { console.error('[NLS] users table failed:', err); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        client TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
        start_date DATE,
        end_date DATE,
        compensation_model TEXT NOT NULL CHECK (compensation_model IN ('FIXED','PERCENT','PACKAGE')),
        price_per_unit NUMERIC(10,2),
        percent_value NUMERIC(5,2),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS task_packages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        price NUMERIC(10,2) NOT NULL
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS task_sellers (
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (task_id, user_id)
      )
    `;

    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS units_label TEXT NOT NULL DEFAULT 'Antal'`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS display_mode TEXT NOT NULL DEFAULT 'COUNT'`;
  } catch (err) { console.error('[NLS] tasks tables failed:', err); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS pay_periods (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS targets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        period_id UUID NOT NULL REFERENCES pay_periods(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        unit_goal INTEGER,
        revenue_goal NUMERIC(10,2),
        UNIQUE(period_id, user_id, task_id)
      )
    `;
  } catch (err) { console.error('[NLS] pay_periods/targets tables failed:', err); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS sales (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        task_id UUID NOT NULL REFERENCES tasks(id),
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        units INTEGER,
        deal_size NUMERIC(10,2),
        package_id UUID REFERENCES task_packages(id),
        note TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','PAID')),
        house_revenue NUMERIC(10,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
  } catch (err) { console.error('[NLS] sales table failed:', err); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        task_id UUID NOT NULL REFERENCES tasks(id),
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        calls_made INTEGER NOT NULL DEFAULT 0,
        contacts_reached INTEGER NOT NULL DEFAULT 0,
        meetings_booked INTEGER NOT NULL DEFAULT 0,
        meetings_held INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
  } catch (err) { console.error('[NLS] activity_logs table failed:', err); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS daily_targets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        call_goal INTEGER NOT NULL DEFAULT 0,
        sales_goal INTEGER NOT NULL DEFAULT 0,
        calls_actual INTEGER NOT NULL DEFAULT 0,
        contacts_actual INTEGER NOT NULL DEFAULT 0,
        meetings_booked_actual INTEGER NOT NULL DEFAULT 0,
        meetings_held_actual INTEGER NOT NULL DEFAULT 0,
        UNIQUE(user_id, date)
      )
    `;
  } catch (err) { console.error('[NLS] daily_targets table failed:', err); }

  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_part_time BOOLEAN NOT NULL DEFAULT FALSE`;

    // Ensure role check constraint includes all roles (safe to run on every boot)
    await sql`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`;
    await sql`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('ADMIN','MANAGER','SELLER','NLCA_MANAGER','NLCA_COUNTRY_MANAGER'))`;
  } catch (err) { console.error('[NLS] users role migration failed:', err); }

  try {
    // Migrations for existing tables
    await sql`ALTER TABLE daily_targets ADD COLUMN IF NOT EXISTS calls_actual INTEGER NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE daily_targets ADD COLUMN IF NOT EXISTS contacts_actual INTEGER NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE daily_targets ADD COLUMN IF NOT EXISTS meetings_booked_actual INTEGER NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE daily_targets ADD COLUMN IF NOT EXISTS meetings_held_actual INTEGER NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS cvr TEXT`;
    await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS company_name TEXT`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS units_label TEXT NOT NULL DEFAULT 'Antal'`;
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS display_mode TEXT NOT NULL DEFAULT 'COUNT'`;
  } catch (err) { console.error('[NLS] daily_targets/sales/tasks column migrations failed:', err); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `;
    await sql`INSERT INTO settings (key, value) VALUES ('desk_count', '0') ON CONFLICT DO NOTHING`;
  } catch (err) { console.error('[NLS] settings table failed:', err); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS sitreps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        went_well TEXT,
        challenges TEXT,
        needs_help TEXT,
        is_support_request BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, date)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS sitrep_replies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sitrep_id UUID NOT NULL REFERENCES sitreps(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id),
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
  } catch (err) { console.error('[NLS] sitreps tables failed:', err); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS followups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sitrep_id UUID REFERENCES sitreps(id),
        title TEXT NOT NULL,
        body TEXT,
        status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED')),
        assigned_to UUID REFERENCES users(id),
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS followup_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        followup_id UUID NOT NULL REFERENCES followups(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id),
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
  } catch (err) { console.error('[NLS] followups tables failed:', err); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS absences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('VACATION','SICK','OTHER')),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        note TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
  } catch (err) { console.error('[NLS] absences table failed:', err); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS time_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        clocked_in_at TIMESTAMPTZ,
        clocked_out_at TIMESTAMPTZ,
        UNIQUE(user_id, date)
      )
    `;
  } catch (err) { console.error('[NLS] time_entries table failed:', err); }

  try {
    // Seed default admin user if none exists
    const [existing] = await sql`SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1`;
    if (!existing) {
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash('admin123', 12);
      await sql`
        INSERT INTO users (email, name, password_hash, role)
        VALUES ('admin@nextlevelgroup.dk', 'Admin', ${hash}, 'ADMIN')
        ON CONFLICT DO NOTHING
      `;
      console.log('[NLS] Default admin created: admin@nextlevelgroup.dk / admin123');
    }
  } catch (err) { console.error('[NLS] default admin seed failed:', err); }

  // ── Platform extensions ────────────────────────────────────────────────────

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        color TEXT NOT NULL,
        logo_initials TEXT NOT NULL,
        ownership_pct INTEGER DEFAULT 100,
        stripe_enabled BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      INSERT INTO companies (name, slug, type, color, logo_initials, ownership_pct, stripe_enabled)
      VALUES
        ('Next Level Sales', 'nls', 'sales', '#4f8ef7', 'NLS', 100, false),
        ('Meridian Consulting', 'meridian', 'consulting', '#2dd4a0', 'MC', 100, false),
        ('Quorex', 'quorex', 'saas', '#a78bfa', 'QX', 100, true),
        ('BusyReminder', 'reminder', 'saas', '#f59e0b', 'BR', 75, true),
        ('NextLevel Group', 'group', 'group', '#4f8ef7', 'NL', 100, false),
        ('CreatorRate', 'creatorrate', 'saas', '#f43f5e', 'CR', 25, false),
        ('Next Level Creator Agency', 'nlca', 'creator_agency', '#06b6d4', 'NLCA', 100, false)
      ON CONFLICT (slug) DO NOTHING
    `;
  } catch (err) { console.error('[NLS] companies table failed:', err); }

  try {
    // companies exists (own try/catch above) — safe to reference it from users
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) NULL`;
  } catch (err) { console.error('[NLS] users.company_id migration failed:', err); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS kanban_boards (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        owner_user_id UUID REFERENCES users(id) NULL,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS kanban_columns (
        id SERIAL PRIMARY KEY,
        board_id INTEGER REFERENCES kanban_boards(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        color TEXT DEFAULT '#4a5d78',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS kanban_cards (
        id SERIAL PRIMARY KEY,
        column_id INTEGER REFERENCES kanban_columns(id) ON DELETE CASCADE,
        board_id INTEGER REFERENCES kanban_boards(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        assigned_to UUID REFERENCES users(id) NULL,
        created_by UUID REFERENCES users(id),
        priority TEXT DEFAULT 'normal',
        due_date DATE NULL,
        position INTEGER DEFAULT 0,
        completed_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS labels TEXT DEFAULT '[]'`;
    await sql`ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS cover_color TEXT NULL`;
  } catch (err) { console.error('[NLS] kanban tables failed:', err); }

  try {
    // NLCA tables
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
    await sql`ALTER TABLE nlca_creators ADD COLUMN IF NOT EXISTS country TEXT`;
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
  } catch (err) { console.error('[NLS] nlca tables failed:', err); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS kanban_card_checklist (
        id SERIAL PRIMARY KEY,
        card_id INTEGER REFERENCES kanban_cards(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        completed BOOLEAN DEFAULT false,
        position INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS kanban_card_comments (
        id SERIAL PRIMARY KEY,
        card_id INTEGER REFERENCES kanban_cards(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) NULL,
        user_name TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
  } catch (err) { console.error('[NLS] kanban card checklist/comments failed:', err); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        name TEXT NOT NULL,
        cvr TEXT,
        contact_name TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        am_user_id UUID REFERENCES users(id) NULL,
        kam_user_id UUID REFERENCES users(id) NULL,
        status TEXT DEFAULT 'active',
        mrr INTEGER DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS customer_products (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        product_name TEXT NOT NULL,
        price_dkk INTEGER NOT NULL,
        status TEXT DEFAULT 'active',
        started_at DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
  } catch (err) { console.error('[NLS] customers/customer_products tables failed:', err); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS handovers (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id),
        company_id INTEGER REFERENCES companies(id),
        what_was_sold TEXT NOT NULL,
        mrr_dkk INTEGER DEFAULT 0,
        customer_goal TEXT,
        promises TEXT,
        am_user_id UUID REFERENCES users(id) NULL,
        kam_user_id UUID REFERENCES users(id) NULL,
        deadline DATE,
        status TEXT DEFAULT 'new_sale',
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
  } catch (err) { console.error('[NLS] handovers table failed:', err); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS portal_access (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id),
        portal_token TEXT UNIQUE NOT NULL,
        last_login TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
  } catch (err) { console.error('[NLS] portal_access table failed:', err); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS channels (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        name TEXT NOT NULL,
        description TEXT,
        created_by UUID REFERENCES users(id),
        is_general BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS channel_members (
        id SERIAL PRIMARY KEY,
        channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        last_read_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(channel_id, user_id)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS messenger_messages (
        id SERIAL PRIMARY KEY,
        channel_id INTEGER REFERENCES channels(id) NULL,
        dm_conversation_id INTEGER NULL,
        sender_id UUID REFERENCES users(id),
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ NULL
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS dm_conversations (
        id SERIAL PRIMARY KEY,
        participant_a UUID REFERENCES users(id),
        participant_b UUID REFERENCES users(id),
        company_id INTEGER REFERENCES companies(id) NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(participant_a, participant_b)
      )
    `;
  } catch (err) { console.error('[NLS] messenger tables failed:', err); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS cr_tickets (
        id            SERIAL PRIMARY KEY,
        type          TEXT NOT NULL CHECK (type IN ('dev', 'support')),
        status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
        priority      TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        title         TEXT NOT NULL,
        description   TEXT,
        assignee_id   UUID REFERENCES users(id) ON DELETE SET NULL,
        reporter_name  TEXT,
        reporter_email TEXT,
        created_by    UUID REFERENCES users(id),
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS cr_tickets_type_idx   ON cr_tickets(type)`;
    await sql`CREATE INDEX IF NOT EXISTS cr_tickets_status_idx ON cr_tickets(status)`;
  } catch (err) { console.error('[NLS] cr_tickets table failed:', err); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS cr_ticket_comments (
        id         SERIAL PRIMARY KEY,
        ticket_id  INTEGER NOT NULL REFERENCES cr_tickets(id) ON DELETE CASCADE,
        user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
        user_name  TEXT NOT NULL DEFAULT '',
        body       TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS cr_ticket_comments_ticket_idx ON cr_ticket_comments(ticket_id)`;
  } catch (err) { console.error('[NLS] cr_ticket_comments table failed:', err); }

  try {
    // HR module — extend users with HR fields
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS start_date DATE NULL`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT NULL`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT NULL`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact TEXT NULL`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'full_time'`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`;
  } catch (err) { console.error('[NLS] users HR columns migration failed:', err); }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS hr_candidates (
        id SERIAL PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        linkedin TEXT,
        applying_for TEXT NOT NULL,
        company_id INTEGER REFERENCES companies(id) NULL,
        stage TEXT NOT NULL DEFAULT 'applied',
        applied_at DATE DEFAULT CURRENT_DATE,
        interview_date TIMESTAMPTZ NULL,
        start_date DATE NULL,
        notes TEXT,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS hr_candidate_comments (
        id SERIAL PRIMARY KEY,
        candidate_id INTEGER REFERENCES hr_candidates(id) ON DELETE CASCADE,
        author_id UUID REFERENCES users(id),
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
  } catch (err) { console.error('[NLS] hr_candidates tables failed:', err); }

  // Base platform tables — re-attempted in isolation so a failure earlier in the main
  // block doesn't leave these tables uncreated on subsequent restarts.
  const { default: sql2 } = await import('./lib/db');

  try {
    await sql2`
      CREATE TABLE IF NOT EXISTS companies (
        id              SERIAL PRIMARY KEY,
        name            TEXT NOT NULL,
        slug            TEXT UNIQUE NOT NULL,
        type            TEXT NOT NULL,
        color           TEXT NOT NULL,
        logo_initials   TEXT NOT NULL,
        ownership_pct   INTEGER DEFAULT 100,
        stripe_enabled  BOOLEAN DEFAULT false,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql2`
      INSERT INTO companies (name, slug, type, color, logo_initials, ownership_pct, stripe_enabled)
      VALUES
        ('Next Level Sales',       'nls',       'sales',           '#4f8ef7', 'NLS', 100, false),
        ('Meridian Consulting',    'meridian',  'consulting',      '#2dd4a0', 'MC',  100, false),
        ('Quorex',                 'quorex',    'saas',            '#a78bfa', 'QX',  100, true),
        ('BusyReminder',           'reminder',  'saas',            '#f59e0b', 'BR',   75, true),
        ('NextLevel Group',        'group',     'group',           '#4f8ef7', 'NL',  100, false),
        ('CreatorRate',            'creatorrate','saas',           '#f43f5e', 'CR',   25, false),
        ('Next Level Creator Agency','nlca',    'creator_agency',  '#06b6d4', 'NLCA',100, false)
      ON CONFLICT (slug) DO NOTHING
    `;
  } catch (err) { console.error('[NLS] companies table/seed failed:', err); }

  // Idempotent column additions for companies (handles tables created before these columns existed)
  try {
    await sql2`ALTER TABLE companies ADD COLUMN IF NOT EXISTS ownership_pct INTEGER DEFAULT 100`;
    await sql2`ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_enabled BOOLEAN DEFAULT false`;
    await sql2`ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_initials TEXT DEFAULT ''`;
    await sql2`ALTER TABLE companies ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#4f8ef7'`;
    // Backfill non-100% ownership for companies that existed before the column was added
    await sql2`UPDATE companies SET ownership_pct = 75 WHERE slug = 'reminder' AND ownership_pct = 100`;
    await sql2`UPDATE companies SET ownership_pct = 25 WHERE slug = 'creatorrate' AND ownership_pct = 100`;
  } catch (err) { console.error('[NLS] companies column migration failed:', err); }

  try {
    await sql2`
      CREATE TABLE IF NOT EXISTS customers (
        id              SERIAL PRIMARY KEY,
        company_id      INTEGER REFERENCES companies(id),
        name            TEXT NOT NULL,
        cvr             TEXT,
        contact_name    TEXT,
        contact_email   TEXT,
        contact_phone   TEXT,
        am_user_id      UUID REFERENCES users(id) NULL,
        kam_user_id     UUID REFERENCES users(id) NULL,
        status          TEXT DEFAULT 'active',
        mrr             INTEGER DEFAULT 0,
        notes           TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `;
  } catch (err) { console.error('[NLS] customers table failed:', err); }

  try {
    await sql2`
      CREATE TABLE IF NOT EXISTS customer_products (
        id           SERIAL PRIMARY KEY,
        customer_id  INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        product_name TEXT NOT NULL,
        price_dkk    INTEGER NOT NULL DEFAULT 0,
        status       TEXT DEFAULT 'active',
        started_at   DATE,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    // Idempotent column migrations — runs on every restart so existing tables get updated
    await sql2`ALTER TABLE customer_products ADD COLUMN IF NOT EXISTS price_dkk INTEGER NOT NULL DEFAULT 0`;
  } catch (err) { console.error('[NLS] customer_products table failed:', err); }

  // Meridian CRM tables — each in its own block so one failure doesn't block the rest

  try {
    await sql2`
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
    await sql2`CREATE INDEX IF NOT EXISTS meridian_stages_owner_idx ON meridian_pipeline_stages(owner_id)`;
  } catch (err) { console.error('[NLS] meridian_pipeline_stages failed:', err); }

  try {
    await sql2`
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
    await sql2`CREATE INDEX IF NOT EXISTS meridian_leads_owner_idx ON meridian_leads(owner_id)`;
    await sql2`CREATE INDEX IF NOT EXISTS meridian_leads_stage_idx ON meridian_leads(stage_id)`;
  } catch (err) { console.error('[NLS] meridian_leads failed:', err); }

  try {
    await sql2`
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
    await sql2`CREATE INDEX IF NOT EXISTS meridian_activities_owner_idx ON meridian_lead_activities(owner_id)`;
    await sql2`CREATE INDEX IF NOT EXISTS meridian_activities_lead_idx  ON meridian_lead_activities(lead_id)`;
  } catch (err) { console.error('[NLS] meridian_lead_activities failed:', err); }

  try {
    await sql2`
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
    await sql2`CREATE INDEX IF NOT EXISTS meridian_tickets_status_idx   ON meridian_tickets(status)`;
    await sql2`CREATE INDEX IF NOT EXISTS meridian_tickets_priority_idx ON meridian_tickets(priority)`;
  } catch (err) { console.error('[NLS] meridian_tickets failed:', err); }

  try {
    await sql2`
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
    await sql2`CREATE INDEX IF NOT EXISTS meridian_ticket_msgs_ticket_idx ON meridian_ticket_messages(ticket_id)`;
  } catch (err) { console.error('[NLS] meridian_ticket_messages failed:', err); }

  try {
    await sql2`
      CREATE TABLE IF NOT EXISTS task_documents (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id        UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        filename       TEXT NOT NULL,
        storage_key    TEXT NOT NULL,
        content_type   TEXT,
        extracted_text TEXT,
        uploaded_by    UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql2`CREATE INDEX IF NOT EXISTS task_documents_task_idx ON task_documents(task_id)`;
  } catch (err) { console.error('[NLS] task_documents failed:', err); }

  try {
    await sql2`
      CREATE TABLE IF NOT EXISTS task_chat_messages (
        id         SERIAL PRIMARY KEY,
        task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role       TEXT NOT NULL CHECK (role IN ('user','assistant')),
        content    TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql2`CREATE INDEX IF NOT EXISTS task_chat_messages_task_user_idx ON task_chat_messages(task_id, user_id)`;
  } catch (err) { console.error('[NLS] task_chat_messages failed:', err); }

  try {
    await sql2`
      CREATE TABLE IF NOT EXISTS sales_calls (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id          UUID REFERENCES tasks(id) ON DELETE SET NULL,
        seller_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        filename         TEXT NOT NULL,
        storage_key      TEXT NOT NULL,
        duration_seconds INTEGER,
        status           TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','done','failed')),
        transcript       TEXT,
        feedback         TEXT,
        error            TEXT,
        created_at       TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql2`CREATE INDEX IF NOT EXISTS sales_calls_seller_idx ON sales_calls(seller_id)`;
  } catch (err) { console.error('[NLS] sales_calls failed:', err); }
}
