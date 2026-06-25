import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const rows = await sql`
    SELECT t.id, t.type, t.next_action, t.next_action_date::text,
           t.deal_id, t.owner_id,
           d.title AS deal_title,
           c.name AS contact_name, c.company_name AS contact_company,
           u.name AS owner_name
    FROM crm_touchpoints t
    LEFT JOIN crm_deals d ON d.id = t.deal_id
    LEFT JOIN crm_contacts c ON c.id = COALESCE(t.contact_id, d.contact_id)
    LEFT JOIN users u ON u.id::text = t.owner_id
    WHERE t.next_action IS NOT NULL
      AND t.next_action_done = FALSE
      AND t.next_action_date IS NOT NULL
    ORDER BY t.next_action_date ASC
    LIMIT 100
  `;

  type Row = (typeof rows)[number];
  const overdue: Row[] = [];
  const todayItems: Row[] = [];
  const thisWeek: Row[] = [];
  const later: Row[] = [];

  for (const row of rows) {
    const d = row.next_action_date as string;
    if (d < today) overdue.push(row);
    else if (d === today) todayItems.push(row);
    else if (d <= weekEndStr) thisWeek.push(row);
    else later.push(row);
  }

  return NextResponse.json({ overdue, today: todayItems, thisWeek, later });
}
