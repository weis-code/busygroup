import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== (process.env.SEED_SECRET ?? 'nls-seed-2026')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [existing] = await sql`SELECT id, email FROM users WHERE role = 'ADMIN' LIMIT 1`;
  if (existing) {
    return NextResponse.json({ ok: true, message: 'Admin already exists', email: existing.email });
  }

  const hash = await bcrypt.hash('admin123', 12);
  const [user] = await sql`
    INSERT INTO users (email, name, password_hash, role)
    VALUES ('admin@busygroup.dk', 'Admin', ${hash}, 'ADMIN')
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    RETURNING id, email
  `;

  return NextResponse.json({ ok: true, message: 'Admin created', email: user.email });
}
