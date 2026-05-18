import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string; productId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const body = await req.json();
  await sql`
    UPDATE sc_products SET
      name        = COALESCE(${body.name        ?? null}, name),
      description = COALESCE(${body.description ?? null}, description),
      price       = COALESCE(${body.price       ?? null}, price),
      currency    = COALESCE(${body.currency    ?? null}, currency),
      active      = COALESCE(${body.active      ?? null}, active)
    WHERE id = ${params.productId} AND client_id = ${params.id}
  `;
  const [product] = await sql`SELECT * FROM sc_products WHERE id = ${params.productId}`;
  return NextResponse.json(product);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; productId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  await sql`DELETE FROM sc_products WHERE id = ${params.productId} AND client_id = ${params.id}`;
  return NextResponse.json({ ok: true });
}
