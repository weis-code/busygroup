export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 });

  try {
    const body = await req.json();
    const [existing] = await sql`SELECT * FROM users WHERE id = ${params.id}`;
    if (!existing) return NextResponse.json({ error: 'Bruger ikke fundet' }, { status: 404 });

    const passwordHash = body.password ? bcrypt.hashSync(body.password, 12) : existing.password_hash;

    await sql`
      UPDATE users SET
        name = ${body.name ?? existing.name},
        role = ${body.role ?? existing.role},
        active = ${body.active ?? existing.active},
        password_hash = ${passwordHash}
      WHERE id = ${params.id}
    `;
    const [updated] = await sql`SELECT id, name, email, role, active, created_at, last_login FROM users WHERE id = ${params.id}`;
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 });
  if (params.id === session.id) return NextResponse.json({ error: 'Du kan ikke slette dig selv' }, { status: 400 });

  // Unassign leads/customers instead of cascade delete
  await sql`UPDATE leads SET assigned_to = NULL WHERE assigned_to = ${params.id}`;
  await sql`UPDATE customers SET assigned_to = NULL WHERE assigned_to = ${params.id}`;
  await sql`DELETE FROM users WHERE id = ${params.id}`;
  return NextResponse.json({ success: true });
}
