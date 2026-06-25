import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get('q') ?? '';
  const contacts = q
    ? await sql`
        SELECT c.*, u.name AS owner_name,
               COUNT(d.id)::int AS deal_count
        FROM crm_contacts c
        LEFT JOIN users u ON u.id::text = c.owner_id
        LEFT JOIN crm_deals d ON d.contact_id = c.id AND d.status = 'open'
        WHERE c.name ILIKE ${'%' + q + '%'} OR c.company_name ILIKE ${'%' + q + '%'}
        GROUP BY c.id, u.name
        ORDER BY c.name
        LIMIT 50
      `
    : await sql`
        SELECT c.*, u.name AS owner_name,
               COUNT(d.id)::int AS deal_count
        FROM crm_contacts c
        LEFT JOIN users u ON u.id::text = c.owner_id
        LEFT JOIN crm_deals d ON d.contact_id = c.id AND d.status = 'open'
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

  const { name, title, company_name, email, phone, linkedin, notes } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Navn kræves' }, { status: 400 });

  const [contact] = await sql`
    INSERT INTO crm_contacts (owner_id, name, title, company_name, email, phone, linkedin, notes)
    VALUES (
      ${session.id},
      ${name.trim()},
      ${title?.trim() ?? null},
      ${company_name?.trim() ?? null},
      ${email?.trim() ?? null},
      ${phone?.trim() ?? null},
      ${linkedin?.trim() ?? null},
      ${notes?.trim() ?? null}
    )
    RETURNING *
  `;

  return NextResponse.json(contact, { status: 201 });
}
