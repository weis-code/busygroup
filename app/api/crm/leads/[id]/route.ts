import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const isAdmin = session.role === 'admin';
  const body = await req.json();
  const now = new Date().toISOString();

  // Sellers can only update their own leads
  if (!isAdmin) {
    const [existing] = await sql`SELECT assigned_to FROM crm_leads WHERE id = ${params.id}`;
    if (!existing || existing.assigned_to !== session.id) {
      return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 });
    }
  }

  await sql`
    UPDATE crm_leads SET
      company       = COALESCE(${body.company ?? null}, company),
      contact_name  = ${body.contact_name  ?? null},
      contact_email = ${body.contact_email ?? null},
      contact_phone = ${body.contact_phone ?? null},
      status        = COALESCE(${body.status ?? null}, status),
      product_id    = ${body.product_id    ?? null},
      deal_value    = COALESCE(${body.deal_value != null ? Number(body.deal_value) : null}, deal_value),
      notes         = ${body.notes         ?? null},
      ${isAdmin ? sql`assigned_to = COALESCE(${body.assigned_to ?? null}, assigned_to),` : sql``}
      updated_at    = ${now}
    WHERE id = ${params.id}
  `;

  const [lead] = await sql`
    SELECT l.*, p.name AS product_name, u.name AS assigned_name
    FROM crm_leads l
    LEFT JOIN products p ON p.id = l.product_id
    LEFT JOIN users u    ON u.id = l.assigned_to
    WHERE l.id = ${params.id}
  `;
  return NextResponse.json(lead);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const isAdmin = session.role === 'admin';
  if (!isAdmin) {
    const [existing] = await sql`SELECT assigned_to FROM crm_leads WHERE id = ${params.id}`;
    if (!existing || existing.assigned_to !== session.id) {
      return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 });
    }
  }

  await sql`DELETE FROM crm_leads WHERE id = ${params.id}`;
  return NextResponse.json({ ok: true });
}
