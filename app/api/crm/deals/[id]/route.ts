import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const ownerFilter = session.role === 'ADMIN' ? sql`` : sql`AND d.owner_id = ${session.id}`;
  const [deal] = await sql`
    SELECT d.*, u.name AS owner_name, co.name AS portfolio_company_name
    FROM crm_deals d
    LEFT JOIN users u ON u.id::text = d.owner_id
    LEFT JOIN companies co ON co.id = d.company_id
    WHERE d.id = ${Number(id)}
      ${ownerFilter}
  `;
  if (!deal) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  const touchpoints = await sql`
    SELECT t.id, t.owner_id, t.deal_id, t.contact_id, t.type, t.direction, t.title, t.body,
           t.outcome, t.duration_minutes, t.next_action, t.next_action_date::text, t.next_action_done,
           t.extra, t.created_at, t.occurred_at, u.name AS owner_name
    FROM crm_touchpoints t
    LEFT JOIN users u ON u.id::text = t.owner_id
    WHERE t.deal_id = ${Number(id)}
    ORDER BY t.created_at DESC
    LIMIT 200
  `;

  const products = await sql`
    SELECT * FROM crm_deal_products WHERE deal_id = ${Number(id)} ORDER BY id ASC
  `;

  return NextResponse.json({ deal, touchpoints, products });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const {
    title, value, stage, status, expected_close, notes, product,
    prospect_name, prospect_company, prospect_phone, prospect_email,
    country, lost_reason,
  } = body;

  const ownerFilter = session.role === 'ADMIN' ? sql`` : sql`AND owner_id = ${session.id}`;
  const [deal] = await sql`
    UPDATE crm_deals SET
      title            = COALESCE(${title?.trim() ?? null}, title),
      value            = COALESCE(${value != null ? Number(value) : null}, value),
      stage            = COALESCE(${(stage as string) ?? null}, stage),
      status           = COALESCE(${(status as string) ?? null}, status),
      expected_close   = COALESCE(${expected_close || null}, expected_close),
      notes            = COALESCE(${notes?.trim() ?? null}, notes),
      product          = COALESCE(${product?.trim() ?? null}, product),
      prospect_name    = COALESCE(${prospect_name?.trim() ?? null}, prospect_name),
      prospect_company = COALESCE(${prospect_company?.trim() ?? null}, prospect_company),
      prospect_phone   = COALESCE(${prospect_phone?.trim() ?? null}, prospect_phone),
      prospect_email   = COALESCE(${prospect_email?.trim() ?? null}, prospect_email),
      country          = COALESCE(${(country as string) ?? null}, country),
      lost_reason      = COALESCE(${lost_reason?.trim() ?? null}, lost_reason)
    WHERE id = ${Number(id)}
      ${ownerFilter}
    RETURNING *
  `;

  if (!deal) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  // company_id can be explicitly null to clear it
  if ('company_id' in body) {
    const companyId: number | null = body.company_id != null ? Number(body.company_id) : null;
    await sql`UPDATE crm_deals SET company_id = ${companyId} WHERE id = ${Number(id)}`;
    deal.company_id = companyId;
  }

  // Auto-set won_at / lost_at on stage transition
  if (stage === 'vundet') {
    const ts = new Date().toISOString();
    await sql`UPDATE crm_deals SET won_at = ${ts} WHERE id = ${Number(id)}`;
    deal.won_at = ts;
  }
  if (stage === 'tabt') {
    const ts = new Date().toISOString();
    await sql`UPDATE crm_deals SET lost_at = ${ts} WHERE id = ${Number(id)}`;
    deal.lost_at = ts;
  }

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
