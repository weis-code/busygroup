import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const users = await sql`
    SELECT u.id, u.email, u.name, u.role, u.is_part_time AS part_time, u.on_daily_board, u.created_at,
           c.name AS company_name, c.slug AS company_slug
    FROM users u
    LEFT JOIN companies c ON c.id = u.company_id
    ORDER BY u.created_at DESC
  `;
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { email, name, password, role, is_part_time, part_time, on_daily_board, company_slug } = await req.json();
  if (!email || !name || !password) {
    return NextResponse.json({ error: 'Email, navn og kodeord kræves' }, { status: 400 });
  }

  const validRoles = ['ADMIN', 'MANAGER', 'SELLER'];
  const userRole = validRoles.includes(role) ? role : 'SELLER';
  const isPartTime = !!(is_part_time ?? part_time);
  const onDailyBoard = !!on_daily_board;

  const hash = await bcrypt.hash(password, 12);

  let companyId: number | null = null;
  if (company_slug) {
    const [co] = await sql`SELECT id FROM companies WHERE slug = ${company_slug} LIMIT 1`;
    companyId = co?.id ?? null;
  }

  const [user] = await sql`
    INSERT INTO users (email, name, password_hash, role, is_part_time, on_daily_board, company_id)
    VALUES (${email.toLowerCase().trim()}, ${name}, ${hash}, ${userRole}, ${isPartTime}, ${onDailyBoard}, ${companyId})
    RETURNING id, email, name, role, is_part_time AS part_time, on_daily_board, created_at
  `;

  return NextResponse.json(user, { status: 201 });
}
