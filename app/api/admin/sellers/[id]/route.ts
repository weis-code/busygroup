import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const from = req.nextUrl.searchParams.get('from') || (() => {
    const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10);
  })();
  const to = req.nextUrl.searchParams.get('to') || new Date().toISOString().slice(0, 10);

  const [user] = await sql`SELECT id, name, email, role, is_part_time FROM users WHERE id = ${params.id}`;
  if (!user) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  const days = await sql`
    SELECT
      d.date::text,
      COALESCE(dt.calls_actual, 0)::int    AS calls,
      COALESCE(dt.contacts_actual, 0)::int AS contacts,
      COALESCE(dt.call_goal, 0)::int       AS call_goal,
      COALESCE(dt.sales_goal, 0)::int      AS sales_goal,
      COALESCE(COUNT(s.id), 0)::int        AS sales
    FROM generate_series(${from}::date, ${to}::date, '1 day'::interval) AS d(date)
    LEFT JOIN daily_targets dt ON dt.user_id = ${params.id} AND dt.date = d.date
    LEFT JOIN sales s ON s.user_id = ${params.id} AND s.date = d.date
    GROUP BY d.date, dt.calls_actual, dt.contacts_actual, dt.call_goal, dt.sales_goal
    ORDER BY d.date DESC
  `;

  const sales = await sql`
    SELECT s.id, s.date::text, s.cvr, s.company_name, s.deal_size, s.status,
           t.name AS task_name, t.display_mode, t.compensation_model,
           tp.name AS package_name
    FROM sales s
    JOIN tasks t ON t.id = s.task_id
    LEFT JOIN task_packages tp ON tp.id = s.package_id
    WHERE s.user_id = ${params.id} AND s.date >= ${from} AND s.date <= ${to}
    ORDER BY s.date DESC, s.created_at DESC
  `;

  return NextResponse.json({ user, days, sales });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { name, email, role, new_password, is_part_time, part_time, company_slug, password } = body;
  const effectivePassword = new_password ?? password;

  // Only ADMIN can change roles or reset passwords
  if (role && session.role !== 'ADMIN') return NextResponse.json({ error: 'Kun admin kan ændre roller' }, { status: 403 });
  if (effectivePassword && session.role !== 'ADMIN') return NextResponse.json({ error: 'Kun admin kan nulstille kodeord' }, { status: 403 });
  if (effectivePassword && effectivePassword.length < 8) return NextResponse.json({ error: 'Kodeord skal være mindst 8 tegn' }, { status: 400 });

  const [existing] = await sql`SELECT id, name, email, role, is_part_time, company_id FROM users WHERE id = ${params.id}`;
  if (!existing) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  const newName     = name  ?? existing.name;
  const newEmail    = email ? email.toLowerCase().trim() : existing.email;
  const newRole     = role  ?? existing.role;
  const newPartTime = (is_part_time !== undefined ? !!is_part_time : (part_time !== undefined ? !!part_time : existing.is_part_time));

  let newCompanyId = existing.company_id;
  if (company_slug !== undefined) {
    if (!company_slug) { newCompanyId = null; }
    else { const [co] = await sql`SELECT id FROM companies WHERE slug = ${company_slug} LIMIT 1`; newCompanyId = co?.id ?? null; }
  }

  if (effectivePassword) {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash(effectivePassword, 12);
    await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${params.id}`;
  }

  const [updated] = await sql`
    UPDATE users SET name = ${newName}, email = ${newEmail}, role = ${newRole}, is_part_time = ${newPartTime}, company_id = ${newCompanyId}
    WHERE id = ${params.id}
    RETURNING id, name, email, role, is_part_time AS part_time
  `;

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Kun admin kan slette brugere' }, { status: 403 });

  // Prevent self-deletion
  if (params.id === session.id) return NextResponse.json({ error: 'Du kan ikke slette dig selv' }, { status: 400 });

  await sql`DELETE FROM users WHERE id = ${params.id}`;
  return NextResponse.json({ ok: true });
}
