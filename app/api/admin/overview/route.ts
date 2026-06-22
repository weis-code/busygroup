import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const today = new Date().toISOString().slice(0, 10);

  // Active pay period — fall back to calendar month
  const [period] = await sql`
    SELECT id, name, start_date::text, end_date::text
    FROM pay_periods
    WHERE start_date <= ${today}::date AND end_date >= ${today}::date
    ORDER BY start_date DESC LIMIT 1
  `;
  const periodStart = period?.start_date ?? today.slice(0, 7) + '-01';
  const periodEnd   = period?.end_date   ?? today;

  // Previous pay period
  const [prevPeriod] = await sql`
    SELECT start_date::text, end_date::text
    FROM pay_periods
    WHERE end_date < ${periodStart}::date
    ORDER BY end_date DESC LIMIT 1
  `;
  const prevStart = prevPeriod?.start_date ?? null;
  const prevEnd   = prevPeriod?.end_date   ?? null;

  // All sales (full list for admin table)
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

  // Revenue: today / current period / previous period
  const [revenue] = await sql`
    SELECT
      COALESCE(SUM(CASE WHEN date = ${today}::date THEN house_revenue ELSE 0 END), 0)::numeric AS today,
      COALESCE(SUM(CASE WHEN date >= ${periodStart}::date AND date <= ${periodEnd}::date THEN house_revenue ELSE 0 END), 0)::numeric AS this_period,
      COALESCE(SUM(CASE WHEN ${prevStart}::date IS NOT NULL
                        AND date >= ${prevStart}::date AND date <= ${prevEnd}::date
                        THEN house_revenue ELSE 0 END), 0)::numeric AS last_period
    FROM sales
  `;

  // Revenue by task — current period
  const byTask = await sql`
    SELECT t.name AS label, SUM(s.house_revenue)::numeric AS value
    FROM sales s JOIN tasks t ON t.id = s.task_id
    WHERE s.date >= ${periodStart}::date AND s.date <= ${periodEnd}::date
    GROUP BY t.name ORDER BY value DESC
  `;

  // Revenue by seller — current period
  const bySeller = await sql`
    SELECT u.name AS label, SUM(s.house_revenue)::numeric AS value
    FROM sales s JOIN users u ON u.id = s.user_id
    WHERE s.date >= ${periodStart}::date AND s.date <= ${periodEnd}::date
    GROUP BY u.name ORDER BY value DESC
  `;

  // Revenue by model — current period
  const byModel = await sql`
    SELECT t.compensation_model AS label, SUM(s.house_revenue)::numeric AS value
    FROM sales s JOIN tasks t ON t.id = s.task_id
    WHERE s.date >= ${periodStart}::date AND s.date <= ${periodEnd}::date
    GROUP BY t.compensation_model ORDER BY value DESC
  `;

  // Seller count (SELLER role only — admins/managers excluded from FTE)
  const [{ seller_count }] = await sql`SELECT COUNT(*)::int AS seller_count FROM users WHERE role = 'SELLER'`;

  // Desk count from settings
  const [deskSetting] = await sql`SELECT value FROM settings WHERE key = 'desk_count'`;
  const desk_count = parseInt(deskSetting?.value ?? '0', 10) || 0;

  // Conversion rate per seller — current period
  const conversionRates = await sql`
    SELECT
      u.name,
      COALESCE(COUNT(DISTINCT s.id), 0)::int        AS sales_month,
      COALESCE(SUM(dt.contacts_actual), 0)::int     AS contacts_month
    FROM users u
    LEFT JOIN sales s ON s.user_id = u.id AND s.date >= ${periodStart}::date AND s.date <= ${periodEnd}::date
    LEFT JOIN daily_targets dt ON dt.user_id = u.id AND dt.date >= ${periodStart}::date AND dt.date <= ${periodEnd}::date
    WHERE u.role = 'SELLER'
    GROUP BY u.id, u.name
    ORDER BY u.name
  `;

  return NextResponse.json({
    sales, revenue, byTask, bySeller, byModel, conversionRates,
    period: period ?? null, prevPeriod: prevPeriod ?? null,
    periodStart, periodEnd,
    seller_count, desk_count,
  });
}
