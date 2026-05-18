import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const deals = await sql`
    SELECT
      d.*,
      u.name  AS salesperson_name,
      p.name  AS product_name,
      p.price AS product_price
    FROM sc_deals d
    LEFT JOIN users u ON u.id = d.salesperson_id
    LEFT JOIN sc_products p ON p.id = d.product_id
    WHERE d.client_id = ${params.id}
    ORDER BY d.closed_at DESC
  `;
  return NextResponse.json(deals);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const body = await req.json();
  if (!body.company_name?.trim()) return NextResponse.json({ error: 'Firmanavn er påkrævet' }, { status: 400 });

  const now = new Date().toISOString();
  const id = randomUUID();
  await sql`
    INSERT INTO sc_deals (
      id, client_id, product_id, company_name, cvr, contact_name,
      contact_email, contact_phone, salesperson_id, deal_value,
      type, status, notes, closed_at, created_at, updated_at
    ) VALUES (
      ${id}, ${params.id}, ${body.product_id || null}, ${body.company_name.trim()},
      ${body.cvr || null}, ${body.contact_name || null}, ${body.contact_email || null},
      ${body.contact_phone || null}, ${body.salesperson_id || null},
      ${Number(body.deal_value) || 0}, ${body.type || 'sales'},
      ${body.status || 'won'}, ${body.notes || null},
      ${body.closed_at || now}, ${now}, ${now}
    )
  `;

  const [deal] = await sql`
    SELECT d.*, u.name AS salesperson_name, p.name AS product_name
    FROM sc_deals d
    LEFT JOIN users u ON u.id = d.salesperson_id
    LEFT JOIN sc_products p ON p.id = d.product_id
    WHERE d.id = ${id}
  `;
  return NextResponse.json(deal, { status: 201 });
}
