import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

function forbidden() { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') return forbidden();

  const { searchParams } = new URL(req.url);
  const stageId  = searchParams.get('stage_id');
  const country  = searchParams.get('country');
  const search   = searchParams.get('search');

  const leads = await sql`
    SELECT
      d.id,
      d.owner_id,
      d.prospect_company AS company_name,
      d.prospect_name    AS contact_name,
      d.contact_title,
      d.prospect_email   AS email,
      d.prospect_phone   AS phone,
      d.linkedin, d.website, d.country, d.industry,
      d.stage_id,
      s.label AS stage_name,
      s.color AS stage_color,
      COALESCE(s.is_won, false)  AS is_won,
      COALESCE(s.is_lost, false) AS is_lost,
      d.products,
      d.value AS deal_value_dkk,
      d.deal_type,
      d.expected_close AS expected_close_date,
      d.probability,
      d.won_at, d.lost_at, d.lost_reason,
      d.notes, d.created_at, d.updated_at,
      (SELECT COUNT(*) FROM crm_touchpoints t WHERE t.deal_id = d.id) AS activity_count,
      (
        SELECT t.next_action || ' · ' || TO_CHAR(t.next_action_date, 'DD. Mon.')
        FROM crm_touchpoints t
        WHERE t.deal_id = d.id AND t.next_action_date IS NOT NULL
        ORDER BY t.next_action_date ASC
        LIMIT 1
      ) AS next_action_label,
      (
        SELECT t.next_action_date
        FROM crm_touchpoints t
        WHERE t.deal_id = d.id AND t.next_action_date IS NOT NULL
        ORDER BY t.next_action_date ASC
        LIMIT 1
      ) AS next_action_date
    FROM crm_deals d
    LEFT JOIN crm_pipeline_stages s ON s.id = d.stage_id
    WHERE d.owner_id = ${session.id}
      AND d.workspace_id = (SELECT id FROM companies WHERE slug = 'meridian')
      AND (${stageId ?? null}::int IS NULL OR d.stage_id = ${stageId ?? null}::int)
      AND (${country ?? null} IS NULL OR d.country = ${country ?? null})
      AND (${search ?? null} IS NULL OR d.prospect_company ILIKE ${'%' + (search ?? '') + '%'} OR d.prospect_name ILIKE ${'%' + (search ?? '') + '%'})
    ORDER BY d.created_at DESC
  `;
  return NextResponse.json(leads);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') return forbidden();

  const body = await req.json() as {
    company_name: string; contact_name?: string; contact_title?: string;
    email?: string; phone?: string; linkedin?: string; website?: string;
    country?: string; industry?: string; stage_id?: number;
    products?: string[]; deal_value_dkk?: number; deal_type?: string;
    expected_close_date?: string; probability?: number; notes?: string;
  };

  if (!body.company_name?.trim()) {
    return NextResponse.json({ error: 'company_name required' }, { status: 400 });
  }

  // Empty-string form fields must become NULL, not be passed through as-is —
  // an empty string in a date column crashes the driver ("Invalid time value").
  const expectedCloseDate = body.expected_close_date?.trim() ? body.expected_close_date : null;

  try {
    const [lead] = await sql`
      INSERT INTO crm_deals (
        owner_id, workspace_id, title,
        prospect_company, prospect_name, contact_title,
        prospect_email, prospect_phone, linkedin, website, country, industry,
        stage_id, products, value, deal_type,
        expected_close, probability, notes
      ) VALUES (
        ${session.id},
        (SELECT id FROM companies WHERE slug = 'meridian'),
        ${body.company_name.trim()},
        ${body.company_name.trim()},
        ${body.contact_name   || null},
        ${body.contact_title  || null},
        ${body.email          || null},
        ${body.phone          || null},
        ${body.linkedin       || null},
        ${body.website        || null},
        ${body.country        ?? 'DK'},
        ${body.industry       || null},
        ${body.stage_id       ?? null},
        ${JSON.stringify(body.products ?? [])}::jsonb,
        ${body.deal_value_dkk ?? 0},
        ${body.deal_type      ?? 'recurring'},
        ${expectedCloseDate},
        ${body.probability    ?? 0},
        ${body.notes          || null}
      )
      RETURNING
        id, owner_id,
        prospect_company AS company_name, prospect_name AS contact_name, contact_title,
        prospect_email AS email, prospect_phone AS phone, linkedin, website, country, industry,
        stage_id, products, value AS deal_value_dkk, deal_type,
        expected_close AS expected_close_date, probability,
        won_at, lost_at, lost_reason, notes, created_at, updated_at
    `;
    return NextResponse.json(lead, { status: 201 });
  } catch (err) {
    console.error('[meridian/crm/leads] POST failed:', err);
    return NextResponse.json({ error: 'Database error', detail: String(err) }, { status: 500 });
  }
}
