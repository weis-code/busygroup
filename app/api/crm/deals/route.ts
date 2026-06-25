import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get('status') ?? 'open';
  const stage  = req.nextUrl.searchParams.get('stage');

  const deals = stage
    ? await sql`
        SELECT d.*, u.name AS owner_name,
               c.name AS contact_name, c.company_name AS contact_company,
               c.phone AS contact_phone, c.email AS contact_email,
               (SELECT COUNT(*)::int FROM crm_touchpoints t WHERE t.deal_id = d.id) AS touchpoint_count,
               (SELECT json_build_object(
                 'id', t.id, 'type', t.type, 'next_action', t.next_action,
                 'next_action_date', t.next_action_date::text
               ) FROM crm_touchpoints t
               WHERE t.deal_id = d.id AND t.next_action IS NOT NULL AND t.next_action_done = FALSE
               ORDER BY t.next_action_date ASC NULLS LAST LIMIT 1) AS next_action_entry
        FROM crm_deals d
        LEFT JOIN users u ON u.id = d.owner_id
        LEFT JOIN crm_contacts c ON c.id = d.contact_id
        WHERE d.status = ${status} AND d.stage = ${stage}
        ORDER BY d.created_at DESC
      `
    : await sql`
        SELECT d.*, u.name AS owner_name,
               c.name AS contact_name, c.company_name AS contact_company,
               c.phone AS contact_phone, c.email AS contact_email,
               (SELECT COUNT(*)::int FROM crm_touchpoints t WHERE t.deal_id = d.id) AS touchpoint_count,
               (SELECT json_build_object(
                 'id', t.id, 'type', t.type, 'next_action', t.next_action,
                 'next_action_date', t.next_action_date::text
               ) FROM crm_touchpoints t
               WHERE t.deal_id = d.id AND t.next_action IS NOT NULL AND t.next_action_done = FALSE
               ORDER BY t.next_action_date ASC NULLS LAST LIMIT 1) AS next_action_entry
        FROM crm_deals d
        LEFT JOIN users u ON u.id = d.owner_id
        LEFT JOIN crm_contacts c ON c.id = d.contact_id
        WHERE d.status = ${status}
        ORDER BY d.created_at DESC
      `;

  return NextResponse.json(deals);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { contact_id, title, value, stage, expected_close, notes } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: 'Titel kræves' }, { status: 400 });

  const [deal] = await sql`
    INSERT INTO crm_deals (owner_id, contact_id, title, value, stage, expected_close, notes)
    VALUES (
      ${Number(session.id)},
      ${contact_id ? Number(contact_id) : null},
      ${title.trim()},
      ${value ? Number(value) : null},
      ${(stage as string) ?? 'lead'},
      ${expected_close ?? null},
      ${notes?.trim() ?? null}
    )
    RETURNING *
  `;

  return NextResponse.json(deal, { status: 201 });
}
