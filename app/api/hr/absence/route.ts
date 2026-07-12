import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const companySlug = req.nextUrl.searchParams.get('company');
  const status      = req.nextUrl.searchParams.get('status');
  const month       = req.nextUrl.searchParams.get('month'); // YYYY-MM

  const absences = await sql`
    SELECT a.id, a.type, a.start_date::text, a.end_date::text, a.note, a.status,
           a.created_at, u.name AS user_name, u.id AS user_id,
           c.name AS company_name, c.slug AS company_slug, c.color AS company_color
    FROM absences a
    JOIN users u ON u.id = a.user_id
    LEFT JOIN companies c ON c.id = u.company_id
    WHERE TRUE
      ${companySlug ? sql`AND c.slug = ${companySlug}` : sql``}
      ${status ? sql`AND a.status = ${status.toUpperCase()}` : sql``}
      ${month  ? sql`AND to_char(a.start_date, 'YYYY-MM') = ${month}` : sql``}
    ORDER BY
      CASE WHEN a.status = 'PENDING' THEN 0 ELSE 1 END,
      a.start_date DESC
  `;
  return NextResponse.json(absences);
}
