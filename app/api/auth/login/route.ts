import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql from '@/lib/db';
import { signSession, COOKIE_NAME } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: 'Email og kodeord kræves' }, { status: 400 });
  }

  const [user] = await sql<{ id: string; email: string; name: string; role: string; password_hash: string }[]>`
    SELECT id, email, name, role, password_hash FROM users WHERE email = ${email.toLowerCase().trim()}
  `;
  if (!user) {
    return NextResponse.json({ error: 'Forkert email eller kodeord' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: 'Forkert email eller kodeord' }, { status: 401 });
  }

  const token = await signSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as 'ADMIN' | 'MANAGER' | 'SELLER',
  });

  const res = NextResponse.json({ ok: true, role: user.role, name: user.name });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}
