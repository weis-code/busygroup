import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const products = await sql`
    SELECT * FROM sc_products WHERE client_id = ${params.id} ORDER BY active DESC, name ASC
  `;
  return NextResponse.json(products);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const { name, description, price, currency } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Navn er påkrævet' }, { status: 400 });

  const id = randomUUID();
  await sql`
    INSERT INTO sc_products (id, client_id, name, description, price, currency, active, created_at)
    VALUES (${id}, ${params.id}, ${name.trim()}, ${description || null}, ${Number(price) || 0}, ${currency || 'DKK'}, true, ${new Date().toISOString()})
  `;
  const [product] = await sql`SELECT * FROM sc_products WHERE id = ${id}`;
  return NextResponse.json(product, { status: 201 });
}
