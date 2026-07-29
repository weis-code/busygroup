import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

function forbidden() { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') return forbidden();

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get('lead_id');

  const activities = await sql`
    SELECT t.id, t.owner_id, t.deal_id AS lead_id, t.type, t.direction, t.title, t.body,
           t.outcome, t.next_action, t.next_action_date, t.occurred_at, t.created_at,
           d.prospect_company AS company_name
    FROM crm_touchpoints t
    JOIN crm_deals d ON d.id = t.deal_id
    WHERE t.owner_id = ${session.id}
      AND d.workspace_id = (SELECT id FROM companies WHERE slug = 'meridian')
      AND (${leadId ?? null}::int IS NULL OR t.deal_id = ${leadId ?? null}::int)
    ORDER BY t.occurred_at DESC, t.created_at DESC
    LIMIT 200
  `;
  return NextResponse.json(activities);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') return forbidden();

  const body = await req.json() as {
    lead_id: number; type: string; direction?: string;
    title?: string; body?: string; outcome?: string;
    next_action?: string; next_action_date?: string; occurred_at?: string;
  };
  if (!body.lead_id || !body.type) {
    return NextResponse.json({ error: 'lead_id and type required' }, { status: 400 });
  }

  const [lead] = await sql`
    SELECT id FROM crm_deals WHERE id = ${body.lead_id} AND owner_id = ${session.id}
      AND workspace_id = (SELECT id FROM companies WHERE slug = 'meridian')
  `;
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const [activity] = await sql`
    INSERT INTO crm_touchpoints
      (owner_id, deal_id, type, direction, title, body, outcome, next_action, next_action_date, occurred_at)
    VALUES (
      ${session.id}, ${body.lead_id}, ${body.type},
      ${body.direction ?? 'outbound'}, ${body.title ?? null},
      ${body.body ?? null}, ${body.outcome ?? null},
      ${body.next_action ?? null}, ${body.next_action_date ?? null},
      COALESCE(${body.occurred_at ?? null}::timestamptz, NOW())
    )
    RETURNING id, owner_id, deal_id AS lead_id, type, direction, title, body,
              outcome, next_action, next_action_date, occurred_at, created_at
  `;
  return NextResponse.json(activity, { status: 201 });
}
