import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

async function ensureNlcaTables() {
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
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureNlcaTables();

  const currentMonth = new Date();
  const monthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01`;

  const managers = await sql`
    SELECT
      m.id,
      m.name,
      m.email,
      m.user_id,
      m.created_at,
      COUNT(DISTINCT c.id)::int AS creator_count,
      COALESCE(
        SUM((COALESCE(f.rank_up_usd, 0) + COALESCE(f.activeness_usd, 0)) * 0.05),
        0
      ) AS payout_this_month
    FROM nlca_managers m
    LEFT JOIN nlca_creators c ON c.manager_id = m.id AND c.is_active = true
    LEFT JOIN nlca_monthly_figures f ON f.creator_id = c.id AND f.month = ${monthStr}::date
    GROUP BY m.id, m.name, m.email, m.user_id, m.created_at
    ORDER BY m.name ASC
  `;

  return NextResponse.json(managers);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureNlcaTables();

  const { name, email, password } = await req.json() as { name: string; email: string; password: string };
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Navn, email og kodeord kræves' }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);

  const [nlcaCompany] = await sql`SELECT id FROM companies WHERE slug = 'nlca' LIMIT 1`;
  const companyId = nlcaCompany?.id ?? null;

  const [user] = await sql`
    INSERT INTO users (email, name, password_hash, role, company_id)
    VALUES (${email.toLowerCase().trim()}, ${name}, ${hash}, 'NLCA_MANAGER', ${companyId})
    RETURNING id, email, name, role
  `;

  const [manager] = await sql`
    INSERT INTO nlca_managers (user_id, name, email)
    VALUES (${user.id as string}, ${name}, ${email.toLowerCase().trim()})
    RETURNING id, user_id, name, email, created_at
  `;

  return NextResponse.json({ ...manager, creator_count: 0, payout_this_month: 0 }, { status: 201 });
}
