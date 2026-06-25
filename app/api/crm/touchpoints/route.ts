import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

const VALID_TYPES = ['call', 'email', 'meeting', 'demo', 'proposal', 'follow_up', 'linkedin', 'note'];

function autoTitle(type: string, direction: string | null, outcome: string | null): string {
  switch (type) {
    case 'call':      return `Opkald${outcome ? ` — ${outcome}` : ''}`;
    case 'email':     return direction === 'inbound' ? 'Email modtaget' : 'Email sendt';
    case 'meeting':   return `Møde${outcome ? ` — ${outcome}` : ''}`;
    case 'demo':      return `Demo${outcome ? ` — ${outcome}` : ''}`;
    case 'proposal':  return 'Tilbud sendt';
    case 'follow_up': return 'Opfølgning';
    case 'linkedin':  return 'LinkedIn aktivitet';
    case 'note':      return 'Note';
    default:          return type;
  }
}

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const dealId    = req.nextUrl.searchParams.get('deal_id');
  const contactId = req.nextUrl.searchParams.get('contact_id');

  if (dealId) {
    const rows = await sql`
      SELECT t.*, u.name AS owner_name
      FROM crm_touchpoints t
      LEFT JOIN users u ON u.id::text = t.owner_id
      WHERE t.deal_id = ${Number(dealId)}
      ORDER BY t.created_at DESC
    `;
    return NextResponse.json(rows);
  }

  if (contactId) {
    const rows = await sql`
      SELECT t.*, u.name AS owner_name, d.title AS deal_title
      FROM crm_touchpoints t
      LEFT JOIN users u ON u.id::text = t.owner_id
      LEFT JOIN crm_deals d ON d.id = t.deal_id
      WHERE t.contact_id = ${Number(contactId)}
         OR t.deal_id IN (SELECT id FROM crm_deals WHERE contact_id = ${Number(contactId)})
      ORDER BY t.created_at DESC
      LIMIT 100
    `;
    return NextResponse.json(rows);
  }

  return NextResponse.json({ error: 'deal_id eller contact_id kræves' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const {
    deal_id, contact_id, type, direction, title, body: noteBody,
    outcome, duration_minutes, next_action, next_action_date, extra,
  } = body;

  if (!deal_id) return NextResponse.json({ error: 'deal_id kræves' }, { status: 400 });
  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Ugyldig type' }, { status: 400 });
  }

  const resolvedTitle = (title?.trim() || autoTitle(type, direction ?? null, outcome ?? null));

  const [row] = await sql`
    INSERT INTO crm_touchpoints (
      owner_id, deal_id, contact_id, type, direction, title, body,
      outcome, duration_minutes, next_action, next_action_date, extra
    ) VALUES (
      ${session.id},
      ${Number(deal_id)},
      ${contact_id ? Number(contact_id) : null},
      ${type},
      ${direction ?? null},
      ${resolvedTitle},
      ${noteBody?.trim() ?? null},
      ${outcome ?? null},
      ${duration_minutes ? Number(duration_minutes) : null},
      ${next_action?.trim() ?? null},
      ${next_action_date ?? null},
      ${JSON.stringify(extra ?? {})}
    )
    RETURNING *
  `;

  return NextResponse.json(row, { status: 201 });
}
