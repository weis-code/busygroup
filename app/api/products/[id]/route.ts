import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();

    const [existing] = await sql`SELECT * FROM products WHERE id = ${params.id}`;
    if (!existing) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

    await sql`
      UPDATE products SET
        name = ${body.name ?? existing.name},
        description = ${body.description ?? existing.description},
        price = ${body.price ?? existing.price},
        type = ${body.type ?? existing.type},
        currency = ${body.currency ?? existing.currency},
        active = ${body.active ?? existing.active}
      WHERE id = ${params.id}
    `;

    const [product] = await sql`SELECT * FROM products WHERE id = ${params.id}`;
    return NextResponse.json(product);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Remove from lead_products first (FK), then delete product
    await sql`DELETE FROM lead_products WHERE product_id = ${params.id}`;
    await sql`DELETE FROM products WHERE id = ${params.id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
