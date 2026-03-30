import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 });

  const body = await req.json();
  const fields = ['name', 'host', 'port', 'tls', 'username', 'password', 'active'];

  for (const field of fields) {
    if (field in body) {
      await sql`UPDATE imap_accounts SET ${sql(field)} = ${body[field]} WHERE id = ${params.id}`;
    }
  }

  const [account] = await sql`
    SELECT id, name, email, host, port, tls, username, active, last_sync FROM imap_accounts WHERE id = ${params.id}
  `;
  return NextResponse.json(account);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 });

  await sql`DELETE FROM imap_accounts WHERE id = ${params.id}`;
  return NextResponse.json({ ok: true });
}
