import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

// Add a product to a deal
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { product_id, name, price, type } = await req.json();

  // If product_id provided, snapshot from products table
  // Positive IDs = crm_products, negative IDs = owner_products (Mine kunder)
  if (product_id != null) {
    const numId = Number(product_id);

    if (numId < 0) {
      // From owner_products (Mine kunder) — store as custom snapshot (no FK)
      const [p] = await sql`SELECT * FROM owner_products WHERE id = ${-numId} AND owner_id = ${session.id}`;
      if (!p) return NextResponse.json({ error: 'Produkt ikke fundet' }, { status: 404 });
      const pType = (p.type as string) === 'onetime' ? 'one_time' : (p.type as string);
      const [row] = await sql`
        INSERT INTO crm_deal_products (deal_id, product_id, name, price, type)
        VALUES (${Number(id)}, NULL, ${p.name}, ${p.price}, ${pType})
        RETURNING *
      `;
      return NextResponse.json(row, { status: 201 });
    }

    const [p] = await sql`SELECT * FROM crm_products WHERE id = ${numId} AND owner_id = ${session.id}`;
    if (!p) return NextResponse.json({ error: 'Produkt ikke fundet' }, { status: 404 });

    const [row] = await sql`
      INSERT INTO crm_deal_products (deal_id, product_id, name, price, type)
      VALUES (${Number(id)}, ${p.id}, ${p.name}, ${p.price}, ${p.type})
      RETURNING *
    `;
    return NextResponse.json(row, { status: 201 });
  }

  // Custom product (free text)
  if (!name?.trim()) return NextResponse.json({ error: 'Navn kræves' }, { status: 400 });
  const [row] = await sql`
    INSERT INTO crm_deal_products (deal_id, product_id, name, price, type)
    VALUES (${Number(id)}, NULL, ${name.trim()}, ${price != null ? Number(price) : null}, ${(type as string) ?? 'one_time'})
    RETURNING *
  `;
  return NextResponse.json(row, { status: 201 });
}
