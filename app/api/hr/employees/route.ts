import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const companySlug = req.nextUrl.searchParams.get('company');
  const role        = req.nextUrl.searchParams.get('role');
  const status      = req.nextUrl.searchParams.get('status') ?? 'active'; // active | inactive | all

  const users = await sql`
    SELECT u.id, u.name, u.email, u.role, u.company_id,
           c.name AS company_name, c.slug AS company_slug, c.color AS company_color,
           u.start_date::text, u.end_date::text, u.is_part_time AS part_time, u.employment_type,
           u.phone, u.address, u.emergency_contact, u.is_active, u.created_at
    FROM users u
    LEFT JOIN companies c ON c.id = u.company_id
    WHERE 1=1
      ${companySlug ? sql`AND c.slug = ${companySlug}` : sql``}
      ${role ? sql`AND u.role = ${role}` : sql``}
      ${status === 'active' ? sql`AND u.is_active = true` : status === 'inactive' ? sql`AND u.is_active = false` : sql``}
    ORDER BY u.name ASC
  `;
  return NextResponse.json(users);
}
