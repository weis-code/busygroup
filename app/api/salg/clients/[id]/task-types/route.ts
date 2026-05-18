import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
  const types = await sql`SELECT * FROM sc_task_types WHERE client_id = ${params.id} ORDER BY name ASC`;
  return NextResponse.json(types);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Kun admin' }, { status: 403 });
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Navn er påkrævet' }, { status: 400 });
  const id = randomUUID();
  await sql`INSERT INTO sc_task_types (id, client_id, name, created_at) VALUES (${id}, ${params.id}, ${name.trim()}, ${new Date().toISOString()})`;
  const [t] = await sql`SELECT * FROM sc_task_types WHERE id = ${id}`;
  return NextResponse.json(t, { status: 201 });
}
