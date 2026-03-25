import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await sql`
      SELECT * FROM products ORDER BY type, price ASC
    `;
    return NextResponse.json(products);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const now = new Date().toISOString();
    const id = randomUUID();

    await sql`
      INSERT INTO products (id, name, description, price, type, currency, active, created_at)
      VALUES (${id}, ${body.name || ''}, ${body.description || null}, ${Number(body.price) || 0}, ${body.type || 'mrr'}, ${body.currency || 'DKK'}, 1, ${now})
    `;

    const [product] = await sql`SELECT * FROM products WHERE id = ${id}`;
    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
