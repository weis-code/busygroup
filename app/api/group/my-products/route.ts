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
    SELECT p.*,
           (SELECT COUNT(*)::int FROM owner_customers c WHERE c.product_id = p.id) AS customer_count
    FROM owner_products p
    WHERE p.owner_id = ${Number(session.id)}
    ORDER BY p.created_at DESC
  `;

  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { name, price, type } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Navn kræves' }, { status: 400 });
  if (price == null || isNaN(Number(price))) return NextResponse.json({ error: 'Pris kræves' }, { status: 400 });

  const [product] = await sql`
    INSERT INTO owner_products (owner_id, name, price, type)
    VALUES (${Number(session.id)}, ${name.trim()}, ${Number(price)}, ${(type as string) ?? 'onetime'})
    RETURNING *
  `;

  return NextResponse.json(product, { status: 201 });
}
