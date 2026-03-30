import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 });

  const accounts = await sql`
    SELECT id, name, email, host, port, tls, username, active, last_sync, created_at
    FROM imap_accounts
    ORDER BY created_at ASC
  `;
  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 });

  const { name, email, host, port = 993, tls = true, username, password } = await req.json();
  if (!name || !email || !host || !username || !password) {
    return NextResponse.json({ error: 'Alle felter er påkrævet' }, { status: 400 });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  await sql`
    INSERT INTO imap_accounts (id, name, email, host, port, tls, username, password, active, created_at)
    VALUES (${id}, ${name}, ${email}, ${host}, ${port}, ${tls}, ${username}, ${password}, true, ${now})
  `;
  return NextResponse.json({ id, name, email, host, port, tls, username, active: true, created_at: now }, { status: 201 });
}
