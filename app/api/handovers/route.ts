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
  const handovers = companySlug
    ? await sql`
        SELECT h.*, cu.name AS customer_name, c.name AS company_name, c.color AS company_color,
               am.name AS am_name, kam.name AS kam_name, cb.name AS created_by_name
        FROM handovers h
        LEFT JOIN customers cu ON cu.id = h.customer_id
        LEFT JOIN companies c ON c.id = h.company_id
        LEFT JOIN users am ON am.id = h.am_user_id
        LEFT JOIN users kam ON kam.id = h.kam_user_id
        LEFT JOIN users cb ON cb.id = h.created_by
        WHERE c.slug = ${companySlug}
        ORDER BY h.created_at DESC
      `
    : await sql`
        SELECT h.*, cu.name AS customer_name, c.name AS company_name, c.color AS company_color,
               am.name AS am_name, kam.name AS kam_name, cb.name AS created_by_name
        FROM handovers h
        LEFT JOIN customers cu ON cu.id = h.customer_id
        LEFT JOIN companies c ON c.id = h.company_id
        LEFT JOIN users am ON am.id = h.am_user_id
        LEFT JOIN users kam ON kam.id = h.kam_user_id
        LEFT JOIN users cb ON cb.id = h.created_by
        ORDER BY h.created_at DESC
      `;

  return NextResponse.json(handovers);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { customer_id, company_id, what_was_sold, mrr_dkk, customer_goal, promises, am_user_id, kam_user_id, deadline } = await req.json();
  if (!company_id || !what_was_sold) {
    return NextResponse.json({ error: 'company_id og what_was_sold kræves' }, { status: 400 });
  }

  const [handover] = await sql`
    INSERT INTO handovers (customer_id, company_id, what_was_sold, mrr_dkk, customer_goal, promises, am_user_id, kam_user_id, deadline, created_by)
    VALUES (${customer_id ?? null}, ${company_id}, ${what_was_sold}, ${mrr_dkk ?? 0}, ${customer_goal ?? null}, ${promises ?? null}, ${am_user_id ?? null}, ${kam_user_id ?? null}, ${deadline ?? null}, ${session.id})
    RETURNING *
  `;
  return NextResponse.json(handover, { status: 201 });
}
