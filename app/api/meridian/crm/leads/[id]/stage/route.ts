import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const { stage_id, lost_reason } = await req.json() as { stage_id: number; lost_reason?: string };

  const ownerFilter = session.role === 'ADMIN' ? sql`` : sql`AND owner_id = ${session.id}`;
  const [existing] = await sql`
    SELECT id, owner_id FROM crm_deals WHERE id = ${Number(id)}
      AND workspace_id = (SELECT id FROM companies WHERE slug = 'meridian')
      ${ownerFilter}
  `;
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // The stage belongs to the deal's own owner's personal pipeline — not
  // necessarily the session's (an ADMIN can move a deal that isn't theirs).
  const [stage] = await sql`
    SELECT * FROM crm_pipeline_stages WHERE id = ${stage_id}
      AND owner_id = ${existing.owner_id} AND workspace_id = (SELECT id FROM companies WHERE slug = 'meridian')
  `;
  if (!stage) return NextResponse.json({ error: 'Stage not found' }, { status: 404 });

  const now = new Date().toISOString();
  const [lead] = await sql`
    UPDATE crm_deals SET
      stage_id    = ${stage_id},
      stage       = ${stage.key},
      probability = ${stage.probability},
      status      = CASE WHEN ${stage.is_won}::boolean THEN 'won' WHEN ${stage.is_lost}::boolean THEN 'lost' ELSE 'open' END,
      won_at      = CASE WHEN ${stage.is_won}::boolean  THEN ${now}::timestamptz ELSE NULL END,
      lost_at     = CASE WHEN ${stage.is_lost}::boolean THEN ${now}::timestamptz ELSE NULL END,
      lost_reason = CASE WHEN ${stage.is_lost}::boolean AND ${lost_reason ?? null} IS NOT NULL
                         THEN ${lost_reason ?? null} ELSE lost_reason END,
      updated_at  = NOW()
    WHERE id = ${Number(id)}
    RETURNING
      id, owner_id,
      prospect_company AS company_name, prospect_name AS contact_name, contact_title,
      prospect_email AS email, prospect_phone AS phone, linkedin, website, country, industry,
      stage_id, products, value AS deal_value_dkk, deal_type,
      expected_close AS expected_close_date, probability,
      won_at, lost_at, lost_reason, notes, created_at, updated_at
  `;
  return NextResponse.json(lead);
}
