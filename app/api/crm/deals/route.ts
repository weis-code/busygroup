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
               (SELECT COUNT(*)::int FROM crm_touchpoints t WHERE t.deal_id = d.id) AS touchpoint_count,
               (SELECT json_build_object(
                 'id', t.id, 'type', t.type, 'next_action', t.next_action,
                 'next_action_date', t.next_action_date::text
               ) FROM crm_touchpoints t
               WHERE t.deal_id = d.id AND t.next_action IS NOT NULL AND t.next_action_done = FALSE
               ORDER BY t.next_action_date ASC NULLS LAST LIMIT 1) AS next_action_entry
        FROM crm_deals d
        LEFT JOIN users u ON u.id::text = d.owner_id
        WHERE d.status = ${status} AND d.stage = ${stage}
        ORDER BY d.created_at DESC
      `
    : await sql`
        SELECT d.*, u.name AS owner_name,
               (SELECT COUNT(*)::int FROM crm_touchpoints t WHERE t.deal_id = d.id) AS touchpoint_count,
               (SELECT json_build_object(
                 'id', t.id, 'type', t.type, 'next_action', t.next_action,
                 'next_action_date', t.next_action_date::text
               ) FROM crm_touchpoints t
               WHERE t.deal_id = d.id AND t.next_action IS NOT NULL AND t.next_action_done = FALSE
               ORDER BY t.next_action_date ASC NULLS LAST LIMIT 1) AS next_action_entry
        FROM crm_deals d
        LEFT JOIN users u ON u.id::text = d.owner_id
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

  const { title, value, stage, expected_close, notes, product, prospect_name, prospect_company, prospect_phone, prospect_email } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: 'Titel kræves' }, { status: 400 });

  const [deal] = await sql`
    INSERT INTO crm_deals (owner_id, title, value, stage, expected_close, notes, product, prospect_name, prospect_company, prospect_phone, prospect_email)
    VALUES (
      ${session.id},
      ${title.trim()},
      ${value ? Number(value) : null},
      ${(stage as string) ?? 'lead'},
      ${expected_close ?? null},
      ${notes?.trim() ?? null},
      ${product?.trim() ?? null},
      ${prospect_name?.trim() ?? null},
      ${prospect_company?.trim() ?? null},
      ${prospect_phone?.trim() ?? null},
      ${prospect_email?.trim() ?? null}
    )
    RETURNING *
  `;

  return NextResponse.json(deal, { status: 201 });
}
