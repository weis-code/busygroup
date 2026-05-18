import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string; dealId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const body = await req.json();
  const now = new Date().toISOString();

  await sql`
    UPDATE sc_deals SET
      company_name   = COALESCE(${body.company_name   ?? null}, company_name),
      cvr            = COALESCE(${body.cvr            ?? null}, cvr),
      contact_name   = COALESCE(${body.contact_name   ?? null}, contact_name),
      contact_email  = COALESCE(${body.contact_email  ?? null}, contact_email),
      contact_phone  = COALESCE(${body.contact_phone  ?? null}, contact_phone),
      salesperson_id = COALESCE(${body.salesperson_id ?? null}, salesperson_id),
      product_id     = COALESCE(${body.product_id     ?? null}, product_id),
      task_type_id   = COALESCE(${body.task_type_id   ?? null}, task_type_id),
      deal_value     = COALESCE(${body.deal_value     ?? null}, deal_value),
      type           = COALESCE(${body.type           ?? null}, type),
      status         = COALESCE(${body.status         ?? null}, status),
      notes          = COALESCE(${body.notes          ?? null}, notes),
      closed_at      = COALESCE(${body.closed_at      ?? null}, closed_at),
      updated_at     = ${now}
    WHERE id = ${params.dealId} AND client_id = ${params.id}
  `;

  const [deal] = await sql`
    SELECT d.*, u.name AS salesperson_name, p.name AS product_name
    FROM sc_deals d
    LEFT JOIN users u ON u.id = d.salesperson_id
    LEFT JOIN sc_products p ON p.id = d.product_id
    WHERE d.id = ${params.dealId}
  `;
  return NextResponse.json(deal);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; dealId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  await sql`DELETE FROM sc_deals WHERE id = ${params.dealId} AND client_id = ${params.id}`;
  return NextResponse.json({ ok: true });
}
