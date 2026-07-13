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
    SELECT a.*, l.company_name
    FROM meridian_lead_activities a
    JOIN meridian_leads l ON l.id = a.lead_id
    WHERE a.owner_id = ${session.id}
      AND (${leadId ?? null}::int IS NULL OR a.lead_id = ${leadId ?? null}::int)
    ORDER BY a.occurred_at DESC, a.created_at DESC
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
    SELECT id FROM meridian_leads WHERE id = ${body.lead_id} AND owner_id = ${session.id}
  `;
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const [activity] = await sql`
    INSERT INTO meridian_lead_activities
      (owner_id, lead_id, type, direction, title, body, outcome, next_action, next_action_date, occurred_at)
    VALUES (
      ${session.id}, ${body.lead_id}, ${body.type},
      ${body.direction ?? 'outbound'}, ${body.title ?? null},
      ${body.body ?? null}, ${body.outcome ?? null},
      ${body.next_action ?? null}, ${body.next_action_date ?? null},
      ${body.occurred_at ? body.occurred_at : 'NOW()'}
    )
    RETURNING *
  `;
  return NextResponse.json(activity, { status: 201 });
}
