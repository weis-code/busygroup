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

  const {
    name, email, host, port = 993, tls = true, username, password,
    smtp_host = null, smtp_port = 587, smtp_secure = false, smtp_user = null, smtp_password = null,
  } = await req.json();

  if (!name || !email || !host || !username || !password) {
    return NextResponse.json({ error: 'Navn, email, IMAP-host, brugernavn og kodeord er påkrævet' }, { status: 400 });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  await sql`
    INSERT INTO imap_accounts (
      id, name, email, host, port, tls, username, password, active, created_at,
      smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password
    ) VALUES (
      ${id}, ${name}, ${email}, ${host}, ${port}, ${tls}, ${username}, ${password}, true, ${now},
      ${smtp_host}, ${smtp_port}, ${smtp_secure}, ${smtp_user}, ${smtp_password}
    )
  `;
  return NextResponse.json({ id, name, email, active: true, created_at: now }, { status: 201 });
}
