import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const products = await sql`
    SELECT * FROM crm_products
    WHERE owner_id = ${session.id} AND active = TRUE
    ORDER BY name ASC
  `;
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { name, price, type, description } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Navn kræves' }, { status: 400 });

  const [product] = await sql`
    INSERT INTO crm_products (owner_id, name, price, type, description)
    VALUES (
      ${session.id},
      ${name.trim()},
      ${price != null ? Number(price) : null},
      ${(type as string) ?? 'monthly'},
      ${description?.trim() ?? null}
    )
    RETURNING *
  `;
  return NextResponse.json(product, { status: 201 });
}
