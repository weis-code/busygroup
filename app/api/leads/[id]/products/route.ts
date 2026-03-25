import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const products = await sql`
      SELECT p.* FROM products p
      JOIN lead_products lp ON lp.product_id = p.id
      WHERE lp.lead_id = ${params.id}
    `;
    return NextResponse.json(products);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { product_id } = await req.json();

    await sql`
      INSERT INTO lead_products (id, lead_id, product_id, created_at)
      VALUES (${randomUUID()}, ${params.id}, ${product_id}, ${new Date().toISOString()})
      ON CONFLICT (lead_id, product_id) DO NOTHING
    `;

    const products = await sql`
      SELECT p.* FROM products p
      JOIN lead_products lp ON lp.product_id = p.id
      WHERE lp.lead_id = ${params.id}
    `;
    return NextResponse.json(products);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { product_id } = await req.json();

    await sql`DELETE FROM lead_products WHERE lead_id = ${params.id} AND product_id = ${product_id}`;

    const products = await sql`
      SELECT p.* FROM products p
      JOIN lead_products lp ON lp.product_id = p.id
      WHERE lp.lead_id = ${params.id}
    `;
    return NextResponse.json(products);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
