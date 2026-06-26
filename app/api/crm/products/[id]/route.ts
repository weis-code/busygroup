import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { name, price, type, description, active } = await req.json();

  const [product] = await sql`
    UPDATE crm_products SET
      name        = COALESCE(${name?.trim() ?? null}, name),
      price       = COALESCE(${price != null ? Number(price) : null}, price),
      type        = COALESCE(${(type as string) ?? null}, type),
      description = COALESCE(${description?.trim() ?? null}, description),
      active      = COALESCE(${active != null ? active : null}, active)
    WHERE id = ${Number(id)} AND owner_id = ${session.id}
    RETURNING *
  `;

  if (!product) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  return NextResponse.json(product);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  await sql`
    UPDATE crm_products SET active = FALSE
    WHERE id = ${Number(id)} AND owner_id = ${session.id}
  `;
  return NextResponse.json({ ok: true });
}
