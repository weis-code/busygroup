import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const [client] = await sql`SELECT * FROM sc_clients WHERE id = ${params.id}`;
  if (!client) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  const sellers = await sql`
    SELECT u.id, u.name FROM sc_client_sellers cs
    JOIN users u ON u.id = cs.user_id
    WHERE cs.client_id = ${params.id}
  `;
  return NextResponse.json({ ...client, assigned_sellers: sellers });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Kun admin' }, { status: 403 });

  const body = await req.json();
  const now = new Date().toISOString();
  await sql`
    UPDATE sc_clients SET
      name           = COALESCE(${body.name           ?? null}, name),
      description    = COALESCE(${body.description    ?? null}, description),
      type           = COALESCE(${body.type           ?? null}, type),
      color          = COALESCE(${body.color          ?? null}, color),
      active         = COALESCE(${body.active         ?? null}, active),
      revenue_model  = COALESCE(${body.revenue_model  ?? null}, revenue_model),
      revenue_fixed  = COALESCE(${body.revenue_fixed  ?? null}, revenue_fixed),
      revenue_pct    = COALESCE(${body.revenue_pct    ?? null}, revenue_pct),
      updated_at     = ${now}
    WHERE id = ${params.id}
  `;
  const [client] = await sql`SELECT * FROM sc_clients WHERE id = ${params.id}`;
  return NextResponse.json(client);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Kun admin' }, { status: 403 });

  await sql`DELETE FROM sc_clients WHERE id = ${params.id}`;
  return NextResponse.json({ ok: true });
}
