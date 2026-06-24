import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const companySlug = req.nextUrl.searchParams.get('companySlug');
  const customers = companySlug
    ? await sql`
        SELECT cu.*, c.name AS company_name, c.color AS company_color,
               am.name AS am_name, kam.name AS kam_name
        FROM customers cu
        LEFT JOIN companies c ON c.id = cu.company_id
        LEFT JOIN users am ON am.id = cu.am_user_id
        LEFT JOIN users kam ON kam.id = cu.kam_user_id
        WHERE c.slug = ${companySlug}
        ORDER BY cu.created_at DESC
      `
    : await sql`
        SELECT cu.*, c.name AS company_name, c.color AS company_color,
               am.name AS am_name, kam.name AS kam_name
        FROM customers cu
        LEFT JOIN companies c ON c.id = cu.company_id
        LEFT JOIN users am ON am.id = cu.am_user_id
        LEFT JOIN users kam ON kam.id = cu.kam_user_id
        ORDER BY cu.created_at DESC
      `;

  return NextResponse.json(customers);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { company_id, name, cvr, contact_name, contact_email, contact_phone, am_user_id, kam_user_id, mrr, notes } = await req.json();
  if (!company_id || !name) {
    return NextResponse.json({ error: 'company_id og name kræves' }, { status: 400 });
  }

  const [customer] = await sql`
    INSERT INTO customers (company_id, name, cvr, contact_name, contact_email, contact_phone, am_user_id, kam_user_id, mrr, notes)
    VALUES (${company_id}, ${name}, ${cvr ?? null}, ${contact_name ?? null}, ${contact_email ?? null}, ${contact_phone ?? null}, ${am_user_id ?? null}, ${kam_user_id ?? null}, ${mrr ?? 0}, ${notes ?? null})
    RETURNING *
  `;
  return NextResponse.json(customer, { status: 201 });
}
