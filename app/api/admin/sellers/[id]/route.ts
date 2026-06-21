import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const from = req.nextUrl.searchParams.get('from') || (() => {
    const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10);
  })();
  const to = req.nextUrl.searchParams.get('to') || new Date().toISOString().slice(0, 10);

  const [user] = await sql`SELECT id, name, email, role FROM users WHERE id = ${params.id}`;
  if (!user) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  // Daily rows: calls, contacts from daily_targets + sales count per day
  const days = await sql`
    SELECT
      d.date::text,
      COALESCE(dt.calls_actual, 0)::int    AS calls,
      COALESCE(dt.contacts_actual, 0)::int AS contacts,
      COALESCE(dt.call_goal, 0)::int       AS call_goal,
      COALESCE(dt.sales_goal, 0)::int      AS sales_goal,
      COALESCE(COUNT(s.id), 0)::int        AS sales
    FROM generate_series(${from}::date, ${to}::date, '1 day'::interval) AS d(date)
    LEFT JOIN daily_targets dt ON dt.user_id = ${params.id} AND dt.date = d.date
    LEFT JOIN sales s ON s.user_id = ${params.id} AND s.date = d.date
    GROUP BY d.date, dt.calls_actual, dt.contacts_actual, dt.call_goal, dt.sales_goal
    ORDER BY d.date DESC
  `;

  // Sales list in period
  const sales = await sql`
    SELECT s.id, s.date::text, s.cvr, s.company_name, s.deal_size, s.status,
           t.name AS task_name, t.display_mode, t.compensation_model,
           tp.name AS package_name
    FROM sales s
    JOIN tasks t ON t.id = s.task_id
    LEFT JOIN task_packages tp ON tp.id = s.package_id
    WHERE s.user_id = ${params.id} AND s.date >= ${from} AND s.date <= ${to}
    ORDER BY s.date DESC, s.created_at DESC
  `;

  return NextResponse.json({ user, days, sales });
}
