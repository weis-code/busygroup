import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const q        = req.nextUrl.searchParams.get('q') ?? '';
  const country  = req.nextUrl.searchParams.get('country');
  const industry = req.nextUrl.searchParams.get('industry');
  // Personal CRM: everyone below ADMIN only sees the contacts they own. The
  // owner (ADMIN) sees everyone's, consistent with /api/crm/deals.
  const ownerFilter = session.role === 'ADMIN' ? sql`` : sql`AND c.owner_id = ${session.id}`;

  const contacts = await sql`
    SELECT c.*, u.name AS owner_name,
           COUNT(DISTINCT d.id)::int AS deal_count,
           MAX(tp.created_at) AS last_activity
    FROM crm_contacts c
    LEFT JOIN users u ON u.id::text = c.owner_id
    LEFT JOIN crm_deals d ON d.contact_id = c.id AND d.status = 'open'
    LEFT JOIN crm_touchpoints tp ON tp.contact_id = c.id
      OR tp.deal_id IN (SELECT id FROM crm_deals WHERE contact_id = c.id)
    WHERE (${q} = '' OR c.name ILIKE ${'%' + q + '%'} OR c.company_name ILIKE ${'%' + q + '%'})
      AND (${country ?? ''} = '' OR c.country = ${country ?? ''})
      AND (${industry ?? ''} = '' OR c.industry = ${industry ?? ''})
      ${ownerFilter}
    GROUP BY c.id, u.name
    ORDER BY c.created_at DESC
    LIMIT 200
  `;

  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { name, title, company_name, email, phone, linkedin, notes, country, industry, website } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Firmanavn kræves' }, { status: 400 });

  const [contact] = await sql`
    INSERT INTO crm_contacts (owner_id, name, title, company_name, email, phone, linkedin, notes, country, industry, website)
    VALUES (
      ${session.id},
      ${name.trim()},
      ${title?.trim() ?? null},
      ${company_name?.trim() ?? null},
      ${email?.trim() ?? null},
      ${phone?.trim() ?? null},
      ${linkedin?.trim() ?? null},
      ${notes?.trim() ?? null},
      ${(country as string) ?? 'DK'},
      ${industry?.trim() ?? null},
      ${website?.trim() ?? null}
    )
    RETURNING *
  `;

  return NextResponse.json(contact, { status: 201 });
}
