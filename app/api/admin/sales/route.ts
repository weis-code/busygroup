import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const date = req.nextUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);

  const sales = await sql`
    SELECT s.id, s.date::text, s.units, s.deal_size, s.status, s.note,
           s.house_revenue, s.created_at::text, s.cvr, s.company_name,
           u.name AS seller_name,
           t.name AS task_name, t.compensation_model, t.display_mode,
           tp.name AS package_name
    FROM sales s
    JOIN users u ON u.id = s.user_id
    JOIN tasks t ON t.id = s.task_id
    LEFT JOIN task_packages tp ON tp.id = s.package_id
    WHERE s.date = ${date}
    ORDER BY s.created_at DESC
  `;

  return NextResponse.json({ sales, date });
}
