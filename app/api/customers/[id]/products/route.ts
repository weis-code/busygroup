export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { randomUUID } from 'crypto';

async function recalcMrr(customerId: string) {
  await sql`
    UPDATE customers SET
      mrr = (
        SELECT COALESCE(SUM(COALESCE(cp.custom_price, p.price)), 0)
        FROM customer_products cp
        JOIN products p ON p.id = cp.product_id
        WHERE cp.customer_id = ${customerId}
          AND COALESCE(cp.custom_type, p.type) = 'mrr'
      ),
      updated_at = ${new Date().toISOString()}
    WHERE id = ${customerId}
  `;
}

function fetchRows(customerId: string) {
  return sql`
    SELECT
      p.id, p.name, p.description, p.price AS default_price,
      p.type AS default_type, p.currency, p.active,
      cp.custom_price,
      cp.custom_type,
      COALESCE(cp.custom_price, p.price) AS effective_price,
      COALESCE(cp.custom_type,  p.type)  AS effective_type
    FROM products p
    JOIN customer_products cp ON cp.product_id = p.id
    WHERE cp.customer_id = ${customerId}
    ORDER BY effective_type, effective_price DESC
  `;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(await fetchRows(params.id));
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
    await recalcMrr(params.id);
    return NextResponse.json(await fetchRows(params.id));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { product_id, custom_price, custom_type } = await req.json();
    await sql`
      UPDATE customer_products
      SET
        custom_price = ${custom_price ?? null},
        custom_type  = ${custom_type  ?? null}
      WHERE customer_id = ${params.id} AND product_id = ${product_id}
    `;
    await recalcMrr(params.id);
    return NextResponse.json(await fetchRows(params.id));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { product_id } = await req.json();
    await sql`DELETE FROM customer_products WHERE customer_id = ${params.id} AND product_id = ${product_id}`;
    await recalcMrr(params.id);
    return NextResponse.json(await fetchRows(params.id));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
