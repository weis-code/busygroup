export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (!process.env.DATABASE_URL) {
    console.warn('[NLS] DATABASE_URL not set — skipping schema init');
    return;
  }

  try {
  const { default: sql } = await import('./lib/db');

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'SELLER' CHECK (role IN ('ADMIN','MANAGER','SELLER')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

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

  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_part_time BOOLEAN NOT NULL DEFAULT FALSE`;

  // Migrations for existing tables
  await sql`ALTER TABLE daily_targets ADD COLUMN IF NOT EXISTS calls_actual INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE daily_targets ADD COLUMN IF NOT EXISTS contacts_actual INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE daily_targets ADD COLUMN IF NOT EXISTS meetings_booked_actual INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE daily_targets ADD COLUMN IF NOT EXISTS meetings_held_actual INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS cvr TEXT`;
  await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS company_name TEXT`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS units_label TEXT NOT NULL DEFAULT 'Antal'`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS display_mode TEXT NOT NULL DEFAULT 'COUNT'`;

  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `;
  await sql`INSERT INTO settings (key, value) VALUES ('desk_count', '0') ON CONFLICT DO NOTHING`;

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

  // ── Platform extensions ────────────────────────────────────────────────────

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
      ('NextLevel Group', 'group', 'group', '#4f8ef7', 'NL', 100, false)
    ON CONFLICT (slug) DO NOTHING
  `;

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

  await sql`
    CREATE TABLE IF NOT EXISTS portal_access (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id),
      portal_token TEXT UNIQUE NOT NULL,
      last_login TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

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
    CREATE TABLE IF NOT EXISTS messages (
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

  } catch (err) {
    console.error('[NLS] Schema init failed:', err);
  }
}
