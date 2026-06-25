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
  const [deal] = await sql`
    SELECT d.*, u.name AS owner_name
    FROM crm_deals d
    LEFT JOIN users u ON u.id::text = d.owner_id
    WHERE d.id = ${Number(id)}
  `;
  if (!deal) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  const touchpoints = await sql`
    SELECT t.*, u.name AS owner_name
    FROM crm_touchpoints t
    LEFT JOIN users u ON u.id::text = t.owner_id
    WHERE t.deal_id = ${Number(id)}
    ORDER BY t.created_at DESC
    LIMIT 200
  `;

  return NextResponse.json({ deal, touchpoints });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { title, value, stage, status, expected_close, notes, product, prospect_name, prospect_company, prospect_phone, prospect_email } = await req.json();

  const [deal] = await sql`
    UPDATE crm_deals SET
      title            = COALESCE(${title?.trim() ?? null}, title),
      value            = COALESCE(${value != null ? Number(value) : null}, value),
      stage            = COALESCE(${(stage as string) ?? null}, stage),
      status           = COALESCE(${(status as string) ?? null}, status),
      expected_close   = COALESCE(${expected_close ?? null}, expected_close),
      notes            = COALESCE(${notes?.trim() ?? null}, notes),
      product          = COALESCE(${product?.trim() ?? null}, product),
      prospect_name    = COALESCE(${prospect_name?.trim() ?? null}, prospect_name),
      prospect_company = COALESCE(${prospect_company?.trim() ?? null}, prospect_company),
      prospect_phone   = COALESCE(${prospect_phone?.trim() ?? null}, prospect_phone),
      prospect_email   = COALESCE(${prospect_email?.trim() ?? null}, prospect_email)
    WHERE id = ${Number(id)}
    RETURNING *
  `;

  if (!deal) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  return NextResponse.json(deal);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  await sql`DELETE FROM crm_deals WHERE id = ${Number(id)}`;
  return NextResponse.json({ ok: true });
}
