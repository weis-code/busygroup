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
  const { name, company, email, phone, product_id, amount, type, closed_date, notes } = await req.json();

  const [customer] = await sql`
    UPDATE owner_customers SET
      name        = COALESCE(${name?.trim() ?? null}, name),
      company     = COALESCE(${company?.trim() ?? null}, company),
      email       = COALESCE(${email?.trim() ?? null}, email),
      phone       = COALESCE(${phone?.trim() ?? null}, phone),
      product_id  = COALESCE(${product_id != null ? Number(product_id) : null}, product_id),
      amount      = COALESCE(${amount != null ? Number(amount) : null}, amount),
      type        = COALESCE(${(type as string) ?? null}, type),
      closed_date = COALESCE(${closed_date ?? null}, closed_date),
      notes       = COALESCE(${notes?.trim() ?? null}, notes)
    WHERE id = ${Number(id)} AND owner_id = ${session.id}
    RETURNING *
  `;

  if (!customer) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  return NextResponse.json(customer);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  await sql`DELETE FROM owner_customers WHERE id = ${Number(id)} AND owner_id = ${session.id}`;
  return NextResponse.json({ ok: true });
}
