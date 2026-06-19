import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [totals] = await sql`
    SELECT
      COALESCE(SUM(CASE WHEN date >= date_trunc('month', CURRENT_DATE)::date THEN house_revenue ELSE 0 END), 0)::numeric AS this_month,
      COALESCE(SUM(CASE WHEN date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date
                        AND date < date_trunc('month', CURRENT_DATE)::date THEN house_revenue ELSE 0 END), 0)::numeric AS last_month
    FROM sales WHERE status != 'PENDING'
  `;

  const byTask = await sql`
    SELECT t.name AS label, SUM(s.house_revenue)::numeric AS value
    FROM sales s JOIN tasks t ON t.id = s.task_id
    WHERE s.date >= date_trunc('month', CURRENT_DATE)::date AND s.status != 'PENDING'
    GROUP BY t.name ORDER BY value DESC
  `;

  const bySeller = await sql`
    SELECT u.name AS label, SUM(s.house_revenue)::numeric AS value
    FROM sales s JOIN users u ON u.id = s.user_id
    WHERE s.date >= date_trunc('month', CURRENT_DATE)::date AND s.status != 'PENDING'
    GROUP BY u.name ORDER BY value DESC
  `;

  const byModel = await sql`
    SELECT t.compensation_model AS label, SUM(s.house_revenue)::numeric AS value
    FROM sales s JOIN tasks t ON t.id = s.task_id
    WHERE s.date >= date_trunc('month', CURRENT_DATE)::date AND s.status != 'PENDING'
    GROUP BY t.compensation_model ORDER BY value DESC
  `;

  return NextResponse.json({ totals, byTask, bySeller, byModel });
}
