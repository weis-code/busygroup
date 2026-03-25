export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const rows = await sql`
      SELECT p.* FROM products p
      JOIN customer_products cp ON cp.product_id = p.id
      WHERE cp.customer_id = ${params.id}
      ORDER BY p.type, p.price DESC
    `;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { product_id } = await req.json();
    await sql`
      INSERT INTO customer_products (id, customer_id, product_id, created_at)
      VALUES (${randomUUID()}, ${params.id}, ${product_id}, ${new Date().toISOString()})
      ON CONFLICT (customer_id, product_id) DO NOTHING
    `;
    const updated = await sql`
      SELECT p.* FROM products p
      JOIN customer_products cp ON cp.product_id = p.id
      WHERE cp.customer_id = ${params.id}
    `;
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { product_id } = await req.json();
    await sql`DELETE FROM customer_products WHERE customer_id = ${params.id} AND product_id = ${product_id}`;
    const updated = await sql`
      SELECT p.* FROM products p
      JOIN customer_products cp ON cp.product_id = p.id
      WHERE cp.customer_id = ${params.id}
    `;
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
