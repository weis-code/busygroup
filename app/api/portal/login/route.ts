import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { signPortalToken, PORTAL_COOKIE, PORTAL_COOKIE_MAX_AGE } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email og adgangskode er påkrævet' }, { status: 400 });
  }

  const rows = await sql`
    SELECT id, company, contact_name, contact_email, portal_password_hash, portal_enabled
    FROM customers
    WHERE portal_email = ${email.toLowerCase().trim()}
    LIMIT 1
  ` as unknown as Array<{
    id: string; company: string; contact_name: string | null;
    contact_email: string | null; portal_password_hash: string | null; portal_enabled: boolean;
  }>;

  const customer = rows[0];

  if (!customer || !customer.portal_enabled || !customer.portal_password_hash) {
    return NextResponse.json({ error: 'Ugyldige login-oplysninger' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, customer.portal_password_hash);
  if (!valid) {
    return NextResponse.json({ error: 'Ugyldige login-oplysninger' }, { status: 401 });
  }

  const token = await signPortalToken({
    id: customer.id,
    company: customer.company,
    contact_name: customer.contact_name,
    contact_email: customer.contact_email,
  });

  const res = NextResponse.json({ ok: true, company: customer.company });
  res.cookies.set(PORTAL_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: PORTAL_COOKIE_MAX_AGE,
    path: '/',
  });
  return res;
}
