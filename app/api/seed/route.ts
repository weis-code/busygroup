import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== (process.env.SEED_SECRET ?? 'nls-seed-2026')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const results: Record<string, unknown> = {};

  // Test DB connection
  try {
    await sql`SELECT 1`;
    results.db_connected = true;
  } catch (err) {
    return NextResponse.json({ db_connected: false, error: String(err) }, { status: 500 });
  }

  // Check which tables exist
  const tables = await sql`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `;
  results.tables = tables.map(t => t.tablename);

  // Create tables if missing
  if (!(results.tables as string[]).includes('users')) {
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
    results.tables_created = true;
  }

  // Seed admin
  const [existing] = await sql`SELECT id, email FROM users WHERE role = 'ADMIN' LIMIT 1`;
  if (existing) {
    results.admin = { existed: true, email: existing.email };
  } else {
    const hash = await bcrypt.hash('admin123', 12);
    const [user] = await sql`
      INSERT INTO users (email, name, password_hash, role)
      VALUES ('admin@busygroup.dk', 'Admin', ${hash}, 'ADMIN')
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
      RETURNING id, email
    `;
    results.admin = { created: true, email: user.email };
  }

  return NextResponse.json({ ok: true, ...results });
}
