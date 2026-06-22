import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const dateFilter = searchParams.get('date');

  const sitreps = await sql`
    SELECT s.id, s.date::text, s.went_well, s.challenges, s.needs_help,
           s.is_support_request, s.created_at,
           u.name AS seller_name, u.id AS seller_id,
           COALESCE(
             json_agg(
               json_build_object('id', r.id, 'body', r.body, 'user_name', ru.name, 'created_at', r.created_at)
               ORDER BY r.created_at
             ) FILTER (WHERE r.id IS NOT NULL),
             '[]'
           ) AS replies,
           COUNT(DISTINCT f.id)::int AS followup_count
    FROM sitreps s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN sitrep_replies r ON r.sitrep_id = s.id
    LEFT JOIN users ru ON ru.id = r.user_id
    LEFT JOIN followups f ON f.sitrep_id = s.id
    ${dateFilter ? sql`WHERE s.date = ${dateFilter}::date` : sql`WHERE s.date >= CURRENT_DATE - INTERVAL '14 days'`}
    GROUP BY s.id, u.name, u.id
    ORDER BY s.date DESC, s.created_at DESC
  `;

  return NextResponse.json(sitreps);
}
