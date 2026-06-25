import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sp         = req.nextUrl.searchParams;
  const type       = sp.get('type');
  const contactId  = sp.get('contact_id');
  const dealId     = sp.get('deal_id');
  const from       = sp.get('from');
  const to         = sp.get('to');
  const page       = Math.max(1, Number(sp.get('page') ?? 1));
  const limit      = Math.min(100, Math.max(1, Number(sp.get('limit') ?? 50)));
  const offset     = (page - 1) * limit;

  const rows = await sql`
    SELECT t.*, u.name AS owner_name,
           d.title AS deal_title, d.stage AS deal_stage,
           c.name AS contact_name, c.company_name AS contact_company
    FROM crm_touchpoints t
    LEFT JOIN users u ON u.id::text = t.owner_id
    LEFT JOIN crm_deals d ON d.id = t.deal_id
    LEFT JOIN crm_contacts c ON c.id = COALESCE(t.contact_id, d.contact_id)
    WHERE 1=1
      ${type       ? sql`AND t.type = ${type}` : sql``}
      ${contactId  ? sql`AND (t.contact_id = ${Number(contactId)} OR d.contact_id = ${Number(contactId)})` : sql``}
      ${dealId     ? sql`AND t.deal_id = ${Number(dealId)}` : sql``}
      ${from       ? sql`AND t.created_at >= ${from}::timestamptz` : sql``}
      ${to         ? sql`AND t.created_at <= ${to}::timestamptz + INTERVAL '1 day'` : sql``}
    ORDER BY t.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [{ count }] = await sql`
    SELECT COUNT(*)::int AS count
    FROM crm_touchpoints t
    LEFT JOIN crm_deals d ON d.id = t.deal_id
    WHERE 1=1
      ${type       ? sql`AND t.type = ${type}` : sql``}
      ${contactId  ? sql`AND (t.contact_id = ${Number(contactId)} OR d.contact_id = ${Number(contactId)})` : sql``}
      ${dealId     ? sql`AND t.deal_id = ${Number(dealId)}` : sql``}
      ${from       ? sql`AND t.created_at >= ${from}::timestamptz` : sql``}
      ${to         ? sql`AND t.created_at <= ${to}::timestamptz + INTERVAL '1 day'` : sql``}
  `;

  return NextResponse.json({ rows, total: count, page, limit });
}
