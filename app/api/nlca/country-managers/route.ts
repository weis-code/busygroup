import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sessionFromRequest } from '@/lib/auth';
import { ensureNlcaTables } from '@/lib/nlca-tables';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

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
      cm.id,
      cm.name,
      cm.email,
      cm.user_id,
      cm.country,
      cm.pct,
      cm.created_at,
      COUNT(DISTINCT c.id)::int AS creator_count,
      COALESCE(
        SUM((COALESCE(f.rank_up_usd, 0) + COALESCE(f.activeness_usd, 0)) * cm.pct / 100.0),
        0
      ) AS payout_this_month
    FROM nlca_country_managers cm
    LEFT JOIN nlca_creators c ON c.country = cm.country AND c.is_active = true
    LEFT JOIN nlca_monthly_figures f ON f.creator_id = c.id AND f.month = ${monthStr}::date
    GROUP BY cm.id, cm.name, cm.email, cm.user_id, cm.country, cm.pct, cm.created_at
    ORDER BY cm.country ASC
  `;

  return NextResponse.json(managers);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await ensureNlcaTables();

  const { name, email, password, country, pct } = await req.json() as {
    name: string;
    email: string;
    password: string;
    country: string;
    pct?: number;
  };
  if (!name || !email || !password || !country) {
    return NextResponse.json({ error: 'Navn, email, kodeord og land kræves' }, { status: 400 });
  }

  try {
    const hash = await bcrypt.hash(password, 12);

    const [nlcaCompany] = await sql`SELECT id FROM companies WHERE slug = 'nlca' LIMIT 1`;
    const companyId = nlcaCompany?.id ?? null;

    const [user] = await sql`
      INSERT INTO users (email, name, password_hash, role, company_id)
      VALUES (${email.toLowerCase().trim()}, ${name}, ${hash}, 'NLCA_COUNTRY_MANAGER', ${companyId})
      RETURNING id, email, name, role
    `;

    const resolvedPct = pct ?? 5.00;

    const [manager] = await sql`
      INSERT INTO nlca_country_managers (user_id, name, email, country, pct)
      VALUES (${user.id as string}, ${name}, ${email.toLowerCase().trim()}, ${country.trim()}, ${resolvedPct})
      RETURNING id, user_id, name, email, country, pct, created_at
    `;

    return NextResponse.json({ ...manager, creator_count: 0, payout_this_month: 0 }, { status: 201 });
  } catch (err) {
    const pg = err as { code?: string; message?: string };
    if (pg.code === '23505') {
      return NextResponse.json({ error: 'Email eller land er allerede i brug' }, { status: 409 });
    }
    console.error('[NLCA] POST /country-managers failed:', pg.code, pg.message, err);
    return NextResponse.json({ error: `Databasefejl (${pg.code ?? 'ukendt'}): ${pg.message ?? ''}` }, { status: 500 });
  }
}
