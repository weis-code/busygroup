export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 });

  const users = await sql`
    SELECT id, name, email, role, active, created_at, last_login FROM users ORDER BY created_at ASC
  `;
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 });

  try {
    const { name, email, password, role = 'seller' } = await req.json();
    if (!name || !email || !password) return NextResponse.json({ error: 'Navn, email og password er påkrævet' }, { status: 400 });

    const [existing] = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase().trim()}`;
    if (existing) return NextResponse.json({ error: 'Email er allerede i brug' }, { status: 409 });

    const password_hash = bcrypt.hashSync(password, 12);
    const id = randomUUID();
    const now = new Date().toISOString();

    await sql`
      INSERT INTO users (id, name, email, password_hash, role, active, created_at)
      VALUES (${id}, ${name}, ${email.toLowerCase().trim()}, ${password_hash}, ${role}, 1, ${now})
    `;

    return NextResponse.json({ id, name, email, role, active: 1, created_at: now }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
