import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

function forbidden() { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }
function notFound()  { return NextResponse.json({ error: 'Not found' }, { status: 404 }); }

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') return forbidden();
  const { id } = await params;
  const ownerFilter = session.role === 'ADMIN' ? sql`` : sql`AND d.owner_id = ${session.id}`;

  const [lead] = await sql`
    SELECT
      d.id, d.owner_id,
      d.prospect_company AS company_name, d.prospect_name AS contact_name, d.contact_title,
      d.prospect_email AS email, d.prospect_phone AS phone, d.linkedin, d.website, d.country, d.industry,
      d.stage_id, d.products, d.value AS deal_value_dkk, d.deal_type,
      d.expected_close AS expected_close_date, d.probability,
      d.won_at, d.lost_at, d.lost_reason, d.notes, d.created_at, d.updated_at,
      s.label AS stage_name, s.color AS stage_color,
      COALESCE(s.is_won, false) AS is_won, COALESCE(s.is_lost, false) AS is_lost,
      (
        SELECT t.next_action || ' · ' || TO_CHAR(t.next_action_date, 'DD. Mon.')
        FROM crm_touchpoints t
        WHERE t.deal_id = d.id AND t.next_action_date IS NOT NULL AND t.next_action_done = FALSE
        ORDER BY t.next_action_date ASC
        LIMIT 1
      ) AS next_action_label,
      (
        SELECT t.next_action_date::text
        FROM crm_touchpoints t
        WHERE t.deal_id = d.id AND t.next_action_date IS NOT NULL AND t.next_action_done = FALSE
        ORDER BY t.next_action_date ASC
        LIMIT 1
      ) AS next_action_date
    FROM crm_deals d
    LEFT JOIN crm_pipeline_stages s ON s.id = d.stage_id
    WHERE d.id = ${Number(id)} AND d.workspace_id = (SELECT id FROM companies WHERE slug = 'meridian')
      ${ownerFilter}
  `;
  if (!lead) return notFound();

  const activities = await sql`
    SELECT id, owner_id, deal_id AS lead_id, type, direction, title, body, outcome,
           next_action, next_action_date::text, next_action_done, occurred_at, created_at
    FROM crm_touchpoints
    WHERE deal_id = ${Number(id)}
    ORDER BY occurred_at DESC, created_at DESC
  `;
  return NextResponse.json({ ...lead, activities });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') return forbidden();
  const { id } = await params;
  const ownerFilter = session.role === 'ADMIN' ? sql`` : sql`AND owner_id = ${session.id}`;

  const body = await req.json() as {
    company_name?: string; contact_name?: string; contact_title?: string;
    email?: string; phone?: string; linkedin?: string; website?: string;
    country?: string; industry?: string; stage_id?: number | null;
    products?: string[]; deal_value_dkk?: number; deal_type?: string;
    expected_close_date?: string | null; probability?: number;
    won_at?: string | null; lost_at?: string | null; lost_reason?: string | null; notes?: string;
  };

  const expectedCloseDate = body.expected_close_date?.trim() ? body.expected_close_date : null;

  try {
    const [updated] = await sql`
      UPDATE crm_deals SET
        prospect_company = COALESCE(${body.company_name || null}, prospect_company),
        prospect_name    = COALESCE(${body.contact_name || null}, prospect_name),
        contact_title    = COALESCE(${body.contact_title || null}, contact_title),
        prospect_email   = COALESCE(${body.email || null}, prospect_email),
        prospect_phone   = COALESCE(${body.phone || null}, prospect_phone),
        linkedin         = COALESCE(${body.linkedin || null}, linkedin),
        website          = COALESCE(${body.website || null}, website),
        country          = COALESCE(${body.country || null}, country),
        industry         = COALESCE(${body.industry || null}, industry),
        value            = COALESCE(${body.deal_value_dkk ?? null}, value),
        deal_type        = COALESCE(${body.deal_type || null}, deal_type),
        expected_close   = COALESCE(${expectedCloseDate}, expected_close),
        probability      = COALESCE(${body.probability ?? null}, probability),
        notes            = COALESCE(${body.notes || null}, notes),
        updated_at       = NOW()
      WHERE id = ${Number(id)} AND workspace_id = (SELECT id FROM companies WHERE slug = 'meridian')
        ${ownerFilter}
      RETURNING
        id, owner_id,
        prospect_company AS company_name, prospect_name AS contact_name, contact_title,
        prospect_email AS email, prospect_phone AS phone, linkedin, website, country, industry,
        stage_id, products, value AS deal_value_dkk, deal_type,
        expected_close AS expected_close_date, probability,
        won_at, lost_at, lost_reason, notes, created_at, updated_at
    `;
    if (!updated) return notFound();

    if ('stage_id' in body) {
      await sql`UPDATE crm_deals SET stage_id = ${body.stage_id ?? null} WHERE id = ${Number(id)}`;
      updated.stage_id = body.stage_id ?? null;
    }
    if ('products' in body) {
      await sql`UPDATE crm_deals SET products = ${JSON.stringify(body.products)}::jsonb WHERE id = ${Number(id)}`;
    }
    if ('won_at' in body)      { await sql`UPDATE crm_deals SET won_at = ${body.won_at || null}           WHERE id = ${Number(id)}`; }
    if ('lost_at' in body)     { await sql`UPDATE crm_deals SET lost_at = ${body.lost_at || null}         WHERE id = ${Number(id)}`; }
    if ('lost_reason' in body) { await sql`UPDATE crm_deals SET lost_reason = ${body.lost_reason || null} WHERE id = ${Number(id)}`; }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[meridian/crm/leads/:id] PATCH failed:', err);
    return NextResponse.json({ error: 'Database error', detail: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') return forbidden();
  const { id } = await params;
  const ownerFilter = session.role === 'ADMIN' ? sql`` : sql`AND owner_id = ${session.id}`;

  const [existing] = await sql`
    SELECT id FROM crm_deals WHERE id = ${Number(id)}
      AND workspace_id = (SELECT id FROM companies WHERE slug = 'meridian')
      ${ownerFilter}
  `;
  if (!existing) return notFound();
  await sql`DELETE FROM crm_deals WHERE id = ${Number(id)}`;
  return NextResponse.json({ ok: true });
}
