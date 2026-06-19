import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== (process.env.SEED_SECRET ?? 'nls-seed-2026')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 500 });
  }

  // Step 1: can we import postgres?
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sql: any;
  try {
    const postgres = (await import('postgres')).default;
    sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false }, max: 1 });
  } catch (err) {
    return NextResponse.json({ step: 'import_postgres', error: String(err) }, { status: 500 });
  }

  // Step 2: can we connect?
  try {
    await sql`SELECT 1`;
  } catch (err) {
    return NextResponse.json({ step: 'db_connect', error: String(err) }, { status: 500 });
  }

  // Step 2b: check if existing users table has correct id type
  try {
    const cols = await sql`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
      ORDER BY ordinal_position
    `;
    if (cols.length > 0) {
      const idCol = cols.find((c: { column_name: string }) => c.column_name === 'id');
      if (!idCol || idCol.udt_name !== 'uuid') {
        // Old schema — drop all tables and start fresh
        await sql`DROP TABLE IF EXISTS activity_logs, sales, targets, task_sellers, task_packages, tasks, pay_periods, users CASCADE`;
      }
    }
  } catch (err) {
    return NextResponse.json({ step: 'check_schema', error: String(err) }, { status: 500 });
  }

  // Step 3: create tables
  try {
    await sql`CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'SELLER' CHECK (role IN ('ADMIN','MANAGER','SELLER')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL, client TEXT NOT NULL, description TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
      start_date DATE, end_date DATE,
      compensation_model TEXT NOT NULL CHECK (compensation_model IN ('FIXED','PERCENT','PACKAGE')),
      price_per_unit NUMERIC(10,2), percent_value NUMERIC(5,2),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS task_packages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      name TEXT NOT NULL, price NUMERIC(10,2) NOT NULL
    )`;
    await sql`CREATE TABLE IF NOT EXISTS task_sellers (
      task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, user_id)
    )`;
    await sql`CREATE TABLE IF NOT EXISTS pay_periods (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS targets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      period_id UUID NOT NULL REFERENCES pay_periods(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      unit_goal INTEGER, revenue_goal NUMERIC(10,2),
      UNIQUE(period_id, user_id, task_id)
    )`;
    await sql`CREATE TABLE IF NOT EXISTS sales (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      task_id UUID NOT NULL REFERENCES tasks(id),
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      units INTEGER, deal_size NUMERIC(10,2),
      package_id UUID REFERENCES task_packages(id),
      note TEXT, status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','PAID')),
      house_revenue NUMERIC(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS activity_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      task_id UUID NOT NULL REFERENCES tasks(id),
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      calls_made INTEGER NOT NULL DEFAULT 0, contacts_reached INTEGER NOT NULL DEFAULT 0,
      meetings_booked INTEGER NOT NULL DEFAULT 0, meetings_held INTEGER NOT NULL DEFAULT 0,
      notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  } catch (err) {
    return NextResponse.json({ step: 'create_tables', error: String(err) }, { status: 500 });
  }

  // Step 3b: daily_targets table
  try {
    await sql`CREATE TABLE IF NOT EXISTS daily_targets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      call_goal INTEGER NOT NULL DEFAULT 0,
      sales_goal INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, date)
    )`;
  } catch (err) {
    return NextResponse.json({ step: 'create_daily_targets', error: String(err) }, { status: 500 });
  }

  // Step 4: hash password
  let hash: string;
  try {
    const bcrypt = (await import('bcryptjs')).default;
    hash = await bcrypt.hash('admin123', 10);
  } catch (err) {
    return NextResponse.json({ step: 'bcrypt', error: String(err) }, { status: 500 });
  }

  // Step 5: seed admin
  try {
    const [user] = await sql`
      INSERT INTO users (email, name, password_hash, role)
      VALUES ('admin@busygroup.dk', 'Admin', ${hash}, 'ADMIN')
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id, email
    `;
    await sql.end();
    return NextResponse.json({ ok: true, admin_email: user.email, password: 'admin123' });
  } catch (err) {
    return NextResponse.json({ step: 'seed_admin', error: String(err) }, { status: 500 });
  }
}
