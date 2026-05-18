import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Kun admin' }, { status: 403 });
  const sellers = await sql`
    SELECT u.id, u.name FROM sc_client_sellers cs
    JOIN users u ON u.id = cs.user_id
    WHERE cs.client_id = ${params.id}
    ORDER BY u.name ASC
  `;
  return NextResponse.json(sellers);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Kun admin' }, { status: 403 });
  const { user_id } = await req.json();
  if (!user_id) return NextResponse.json({ error: 'user_id er påkrævet' }, { status: 400 });
  const id = randomUUID();
  await sql`
    INSERT INTO sc_client_sellers (id, client_id, user_id, created_at)
    VALUES (${id}, ${params.id}, ${user_id}, ${new Date().toISOString()})
    ON CONFLICT (client_id, user_id) DO NOTHING
  `;
  return NextResponse.json({ ok: true });
}
