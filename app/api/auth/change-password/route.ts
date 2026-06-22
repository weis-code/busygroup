import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const { current_password, new_password } = await req.json();
  if (!current_password || !new_password) {
    return NextResponse.json({ error: 'Begge felter kræves' }, { status: 400 });
  }
  if (new_password.length < 8) {
    return NextResponse.json({ error: 'Nyt kodeord skal være mindst 8 tegn' }, { status: 400 });
  }

  const [user] = await sql`SELECT password_hash FROM users WHERE id = ${session.id}`;
  if (!user) return NextResponse.json({ error: 'Bruger ikke fundet' }, { status: 404 });

  const valid = await bcrypt.compare(current_password, user.password_hash);
  if (!valid) return NextResponse.json({ error: 'Nuværende kodeord er forkert' }, { status: 400 });

  const hash = await bcrypt.hash(new_password, 10);
  await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${session.id}`;

  return NextResponse.json({ ok: true });
}
