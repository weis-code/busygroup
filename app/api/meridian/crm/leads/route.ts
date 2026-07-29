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
      l.*,
      s.name  AS stage_name,
      s.color AS stage_color,
      s.is_won,
      s.is_lost,
      (SELECT COUNT(*) FROM meridian_lead_activities a WHERE a.lead_id = l.id) AS activity_count,
      (
        SELECT a.next_action || ' · ' || TO_CHAR(a.next_action_date, 'DD. Mon.')
        FROM meridian_lead_activities a
        WHERE a.lead_id = l.id AND a.next_action_date IS NOT NULL
        ORDER BY a.next_action_date ASC
        LIMIT 1
      ) AS next_action_label,
      (
        SELECT a.next_action_date
        FROM meridian_lead_activities a
        WHERE a.lead_id = l.id AND a.next_action_date IS NOT NULL
        ORDER BY a.next_action_date ASC
        LIMIT 1
      ) AS next_action_date
    FROM meridian_leads l
    LEFT JOIN meridian_pipeline_stages s ON s.id = l.stage_id
    WHERE l.owner_id = ${session.id}
      AND (${stageId ?? null}::int IS NULL OR l.stage_id = ${stageId ?? null}::int)
      AND (${country ?? null} IS NULL OR l.country = ${country ?? null})
      AND (${search ?? null} IS NULL OR l.company_name ILIKE ${'%' + (search ?? '') + '%'} OR l.contact_name ILIKE ${'%' + (search ?? '') + '%'})
    ORDER BY l.created_at DESC
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
      INSERT INTO meridian_leads (
        owner_id, company_name, contact_name, contact_title,
        email, phone, linkedin, website, country, industry,
        stage_id, products, deal_value_dkk, deal_type,
        expected_close_date, probability, notes
      ) VALUES (
        ${session.id},
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
      RETURNING *
    `;
    return NextResponse.json(lead, { status: 201 });
  } catch (err) {
    console.error('[meridian/crm/leads] POST failed:', err);
    return NextResponse.json({ error: 'Database error', detail: String(err) }, { status: 500 });
  }
}
