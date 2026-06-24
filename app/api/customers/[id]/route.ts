import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const [customer] = await sql`
    SELECT cu.*, c.name AS company_name, c.color AS company_color,
           am.name AS am_name, kam.name AS kam_name
    FROM customers cu
    LEFT JOIN companies c ON c.id = cu.company_id
    LEFT JOIN users am ON am.id = cu.am_user_id
    LEFT JOIN users kam ON kam.id = cu.kam_user_id
    WHERE cu.id = ${id}
  `;
  if (!customer) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  const products = await sql`SELECT * FROM customer_products WHERE customer_id = ${id} ORDER BY started_at DESC`;
  return NextResponse.json({ ...customer, products });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const [customer] = await sql`
    UPDATE customers SET
      name          = COALESCE(${body.name ?? null}, name),
      cvr           = COALESCE(${body.cvr ?? null}, cvr),
      contact_name  = COALESCE(${body.contact_name ?? null}, contact_name),
      contact_email = COALESCE(${body.contact_email ?? null}, contact_email),
      contact_phone = COALESCE(${body.contact_phone ?? null}, contact_phone),
      am_user_id    = COALESCE(${body.am_user_id ?? null}, am_user_id),
      kam_user_id   = COALESCE(${body.kam_user_id ?? null}, kam_user_id),
      status        = COALESCE(${body.status ?? null}, status),
      mrr           = COALESCE(${body.mrr ?? null}, mrr),
      notes         = COALESCE(${body.notes ?? null}, notes)
    WHERE id = ${id}
    RETURNING *
  `;
  return NextResponse.json(customer);
}
