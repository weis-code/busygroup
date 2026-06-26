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
  const [contact] = await sql`
    SELECT c.*, u.name AS owner_name
    FROM crm_contacts c
    LEFT JOIN users u ON u.id::text = c.owner_id
    WHERE c.id = ${Number(id)} AND c.owner_id = ${session.id}
  `;
  if (!contact) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  const deals = await sql`
    SELECT d.*, u.name AS owner_name, co.name AS portfolio_company_name
    FROM crm_deals d
    LEFT JOIN users u ON u.id::text = d.owner_id
    LEFT JOIN companies co ON co.id = d.company_id
    WHERE d.contact_id = ${Number(id)}
    ORDER BY d.created_at DESC
  `;

  const touchpoints = await sql`
    SELECT t.*, u.name AS owner_name, d.title AS deal_title
    FROM crm_touchpoints t
    LEFT JOIN users u ON u.id::text = t.owner_id
    LEFT JOIN crm_deals d ON d.id = t.deal_id
    WHERE t.contact_id = ${Number(id)}
       OR t.deal_id IN (SELECT id FROM crm_deals WHERE contact_id = ${Number(id)})
    ORDER BY t.created_at DESC
    LIMIT 100
  `;

  return NextResponse.json({ contact, deals, touchpoints });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { name, title, company_name, email, phone, linkedin, notes, country, industry, website } = await req.json();

  const [contact] = await sql`
    UPDATE crm_contacts SET
      name         = COALESCE(${name?.trim() ?? null}, name),
      title        = COALESCE(${title?.trim() ?? null}, title),
      company_name = COALESCE(${company_name?.trim() ?? null}, company_name),
      email        = COALESCE(${email?.trim() ?? null}, email),
      phone        = COALESCE(${phone?.trim() ?? null}, phone),
      linkedin     = COALESCE(${linkedin?.trim() ?? null}, linkedin),
      notes        = COALESCE(${notes?.trim() ?? null}, notes),
      country      = COALESCE(${(country as string) ?? null}, country),
      industry     = COALESCE(${industry?.trim() ?? null}, industry),
      website      = COALESCE(${website?.trim() ?? null}, website)
    WHERE id = ${Number(id)} AND owner_id = ${session.id}
    RETURNING *
  `;

  if (!contact) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  return NextResponse.json(contact);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  await sql`DELETE FROM crm_contacts WHERE id = ${Number(id)}`;
  return NextResponse.json({ ok: true });
}
