import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // All sales with full context
  const sales = await sql`
    SELECT s.id, s.date::text, s.units, s.deal_size, s.status, s.note,
           s.house_revenue, s.created_at,
           u.name AS seller_name,
           t.name AS task_name, t.compensation_model,
           tp.name AS package_name
    FROM sales s
    JOIN users u ON u.id = s.user_id
    JOIN tasks t ON t.id = s.task_id
    LEFT JOIN task_packages tp ON tp.id = s.package_id
    ORDER BY s.date DESC, s.created_at DESC
    LIMIT 500
  `;

  // Revenue today / this month / last month
  const [revenue] = await sql`
    SELECT
      COALESCE(SUM(CASE WHEN date = CURRENT_DATE THEN house_revenue ELSE 0 END), 0)::numeric AS today,
      COALESCE(SUM(CASE WHEN date >= date_trunc('month', CURRENT_DATE)::date THEN house_revenue ELSE 0 END), 0)::numeric AS this_month,
      COALESCE(SUM(CASE WHEN date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date
                        AND date < date_trunc('month', CURRENT_DATE)::date THEN house_revenue ELSE 0 END), 0)::numeric AS last_month
    FROM sales
  `;

  // Revenue by task
  const byTask = await sql`
    SELECT t.name AS label, SUM(s.house_revenue)::numeric AS value
    FROM sales s JOIN tasks t ON t.id = s.task_id
    WHERE s.date >= date_trunc('month', CURRENT_DATE)::date AND s.status != 'PENDING'
    GROUP BY t.name ORDER BY value DESC
  `;

  // Revenue by seller
  const bySeller = await sql`
    SELECT u.name AS label, SUM(s.house_revenue)::numeric AS value
    FROM sales s JOIN users u ON u.id = s.user_id
    WHERE s.date >= date_trunc('month', CURRENT_DATE)::date AND s.status != 'PENDING'
    GROUP BY u.name ORDER BY value DESC
  `;

  // Revenue by compensation model
  const byModel = await sql`
    SELECT t.compensation_model AS label, SUM(s.house_revenue)::numeric AS value
    FROM sales s JOIN tasks t ON t.id = s.task_id
    WHERE s.date >= date_trunc('month', CURRENT_DATE)::date AND s.status != 'PENDING'
    GROUP BY t.compensation_model ORDER BY value DESC
  `;

  // Conversion rate per seller this month
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  const conversionRates = await sql`
    SELECT
      u.name,
      COALESCE(COUNT(DISTINCT s.id), 0)::int        AS sales_month,
      COALESCE(SUM(dt.contacts_actual), 0)::int     AS contacts_month
    FROM users u
    LEFT JOIN sales s ON s.user_id = u.id AND s.date >= ${monthStartStr}
    LEFT JOIN daily_targets dt ON dt.user_id = u.id AND dt.date >= ${monthStartStr}
    WHERE u.role = 'SELLER'
    GROUP BY u.id, u.name
    ORDER BY u.name
  `;

  return NextResponse.json({ sales, revenue, byTask, bySeller, byModel, conversionRates });
}
