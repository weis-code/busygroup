export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { signToken, COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/auth';

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'seller';
  active: number;
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email og password er påkrævet' }, { status: 400 });
    }

    const [user] = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase().trim()} AND active = 1` as unknown as [UserRow | undefined];

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return NextResponse.json({ error: 'Forkert email eller password' }, { status: 401 });
    }

    // Update last login
    await sql`UPDATE users SET last_login = ${new Date().toISOString()} WHERE id = ${user.id}`;

    const token = await signToken({ id: user.id, name: user.name, email: user.email, role: user.role });

    const res = NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });
    return res;
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
