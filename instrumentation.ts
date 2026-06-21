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

  // Migrations for existing tables
  await sql`ALTER TABLE daily_targets ADD COLUMN IF NOT EXISTS calls_actual INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE daily_targets ADD COLUMN IF NOT EXISTS contacts_actual INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE daily_targets ADD COLUMN IF NOT EXISTS meetings_booked_actual INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE daily_targets ADD COLUMN IF NOT EXISTS meetings_held_actual INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS cvr TEXT`;
  await sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS company_name TEXT`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS units_label TEXT NOT NULL DEFAULT 'Antal'`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS display_mode TEXT NOT NULL DEFAULT 'COUNT'`;

  // Seed default admin user if none exists
  const [existing] = await sql`SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1`;
  if (!existing) {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('admin123', 12);
    await sql`
      INSERT INTO users (email, name, password_hash, role)
      VALUES ('admin@busygroup.dk', 'Admin', ${hash}, 'ADMIN')
      ON CONFLICT DO NOTHING
    `;
    console.log('[NLS] Default admin created: admin@busygroup.dk / admin123');
  }
  } catch (err) {
    console.error('[NLS] Schema init failed:', err);
  }
}
