import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const users = await sql`
    SELECT id, email, name, role, is_part_time, created_at FROM users ORDER BY created_at DESC
  `;
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { email, name, password, role, is_part_time } = await req.json();
  if (!email || !name || !password) {
    return NextResponse.json({ error: 'Email, navn og kodeord kræves' }, { status: 400 });
  }

  const validRoles = ['ADMIN', 'MANAGER', 'SELLER'];
  const userRole = validRoles.includes(role) ? role : 'SELLER';

  const hash = await bcrypt.hash(password, 12);

  const [user] = await sql`
    INSERT INTO users (email, name, password_hash, role, is_part_time)
    VALUES (${email.toLowerCase().trim()}, ${name}, ${hash}, ${userRole}, ${!!is_part_time})
    RETURNING id, email, name, role, is_part_time, created_at
  `;

  return NextResponse.json(user, { status: 201 });
}
