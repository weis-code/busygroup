import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const customers = await sql`
    SELECT c.*, p.name AS product_name, p.type AS product_type
    FROM owner_customers c
    LEFT JOIN owner_products p ON p.id = c.product_id
    WHERE c.owner_id = ${session.id}
    ORDER BY c.created_at DESC
  `;

  return NextResponse.json(customers);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { name, company, email, phone, product_id, amount, type, closed_date, notes } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Navn kræves' }, { status: 400 });

  const [customer] = await sql`
    INSERT INTO owner_customers (owner_id, name, company, email, phone, product_id, amount, type, closed_date, notes)
    VALUES (
      ${session.id},
      ${name.trim()},
      ${company?.trim() ?? null},
      ${email?.trim() ?? null},
      ${phone?.trim() ?? null},
      ${product_id ? Number(product_id) : null},
      ${amount != null ? Number(amount) : null},
      ${(type as string) ?? 'onetime'},
      ${closed_date ?? null},
      ${notes?.trim() ?? null}
    )
    RETURNING *
  `;

  return NextResponse.json(customer, { status: 201 });
}
