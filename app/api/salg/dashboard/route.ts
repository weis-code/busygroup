import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MONTHS_DA = ['januar','februar','marts','april','maj','juni','juli','august','september','oktober','november','december'];

function getMonthBounds(key: string) {
  const [y, m] = key.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    key,
    start: `${y}-${pad(m)}-01`,
    end:   `${y}-${pad(m)}-${pad(lastDay)}`,
    label: `${MONTHS_DA[m - 1]} ${y}`,
  };
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get('month') || currentKey;
  const month = getMonthBounds(monthParam);

  const today = now.toISOString().slice(0, 10);
  const isCurrentMonth = monthParam === currentKey;

  const [todayRow] = await sql`
    SELECT COUNT(*) AS count
    FROM sc_deals d
    WHERE d.status = 'won' AND d.closed_at = ${today}
  `;

  const [periodRow] = await sql`
    SELECT COUNT(*) AS count
    FROM sc_deals d
    WHERE d.status = 'won' AND d.closed_at >= ${month.start} AND d.closed_at <= ${month.end}
  `;

  const byOpgave = await sql`
    SELECT c.id, c.name, c.color,
      COUNT(CASE WHEN d.closed_at = ${today} THEN 1 END) AS today_count,
      COUNT(CASE WHEN d.closed_at >= ${month.start} AND d.closed_at <= ${month.end} THEN 1 END) AS period_count
    FROM sc_clients c
    LEFT JOIN sc_deals d ON d.client_id = c.id AND d.status = 'won'
    WHERE c.active = true
    GROUP BY c.id, c.name, c.color
    ORDER BY period_count DESC, today_count DESC, c.name ASC
  `;

  const sellers = await sql`
    SELECT u.id, u.name,
      COUNT(CASE WHEN d.closed_at >= ${month.start} AND d.closed_at <= ${month.end} AND d.status = 'won' THEN 1 END) AS deals_count,
      COUNT(CASE WHEN d.closed_at = ${today} AND d.status = 'won' THEN 1 END) AS today_count,
      COALESCE(g.deals_goal, 0) AS deals_goal
    FROM users u
    LEFT JOIN sc_deals d ON d.salesperson_id = u.id
    LEFT JOIN sc_goals g ON g.user_id = u.id AND g.period = ${month.key}
    WHERE u.role IN ('admin', 'seller') AND u.active = 1
    GROUP BY u.id, u.name, g.deals_goal
    ORDER BY deals_count DESC, u.name ASC
  `;

  const recent = await sql`
    SELECT d.id, d.company_name, d.closed_at, d.created_at,
      u.name AS salesperson_name,
      c.name AS client_name, c.color AS client_color
    FROM sc_deals d
    LEFT JOIN users u ON u.id = d.salesperson_id
    LEFT JOIN sc_clients c ON c.id = d.client_id
    WHERE d.status = 'won' AND d.closed_at >= ${month.start} AND d.closed_at <= ${month.end}
    ORDER BY d.closed_at DESC, d.created_at DESC
    LIMIT 20
  `;

  return NextResponse.json({
    month,
    isCurrentMonth,
    today:  { count: Number(todayRow.count) },
    period: { count: Number(periodRow.count) },
    byOpgave: byOpgave.map(o => ({
      id: o.id, name: o.name, color: o.color,
      today_count:  Number(o.today_count),
      period_count: Number(o.period_count),
    })),
    sellers: sellers.map(s => ({
      id: s.id, name: s.name,
      deals_count: Number(s.deals_count),
      today_count: Number(s.today_count),
      deals_goal:  Number(s.deals_goal),
    })),
    recent: recent.map(d => ({
      id: d.id, company_name: d.company_name,
      closed_at: d.closed_at, created_at: d.created_at,
      salesperson_name: d.salesperson_name,
      client_name: d.client_name, client_color: d.client_color,
    })),
  });
}
