import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getPayPeriod(now: Date) {
  const day = now.getDate();
  let sy = now.getFullYear();
  let sm = now.getMonth(); // 0-indexed
  if (day < 21) {
    if (sm === 0) { sm = 11; sy--; } else sm--;
  }
  const ey = sm === 11 ? sy + 1 : sy;
  const em = (sm + 1) % 12;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    start: `${sy}-${pad(sm + 1)}-21`,
    end:   `${ey}-${pad(em + 1)}-20`,
    key:   `${sy}-${pad(sm + 1)}-21`,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const pp = getPayPeriod(now);

  const [todayRow] = await sql`
    SELECT COUNT(*) AS count
    FROM sc_deals d
    JOIN sc_clients c ON c.id = d.client_id
    WHERE d.status = 'won' AND d.closed_at = ${today}
  `;

  const [periodRow] = await sql`
    SELECT COUNT(*) AS count
    FROM sc_deals d
    JOIN sc_clients c ON c.id = d.client_id
    WHERE d.status = 'won' AND d.closed_at >= ${pp.start} AND d.closed_at <= ${pp.end}
  `;

  // Per active client: today count + period count
  const byOpgave = await sql`
    SELECT c.id, c.name, c.color,
      COUNT(CASE WHEN d.closed_at = ${today} THEN 1 END) AS today_count,
      COUNT(CASE WHEN d.closed_at >= ${pp.start} AND d.closed_at <= ${pp.end} THEN 1 END) AS period_count
    FROM sc_clients c
    LEFT JOIN sc_deals d ON d.client_id = c.id AND d.status = 'won'
    WHERE c.active = true
    GROUP BY c.id, c.name, c.color
    ORDER BY period_count DESC, today_count DESC, c.name ASC
  `;

  // Sellers ranked by period deals, with goal for this pay period
  const sellers = await sql`
    SELECT u.id, u.name,
      COUNT(CASE WHEN d.closed_at >= ${pp.start} AND d.closed_at <= ${pp.end} AND d.status = 'won' THEN 1 END) AS deals_count,
      COUNT(CASE WHEN d.closed_at = ${today} AND d.status = 'won' THEN 1 END) AS today_count,
      COALESCE(g.deals_goal, 0) AS deals_goal
    FROM users u
    LEFT JOIN sc_deals d ON d.salesperson_id = u.id
    LEFT JOIN sc_goals g ON g.user_id = u.id AND g.period = ${pp.key}
    WHERE u.role IN ('admin', 'seller') AND u.active = 1
    GROUP BY u.id, u.name, g.deals_goal
    ORDER BY deals_count DESC, u.name ASC
  `;

  // Recent won deals within current pay period
  const recent = await sql`
    SELECT d.id, d.company_name, d.closed_at, d.created_at,
      u.name AS salesperson_name,
      c.name AS client_name, c.color AS client_color
    FROM sc_deals d
    LEFT JOIN users u ON u.id = d.salesperson_id
    LEFT JOIN sc_clients c ON c.id = d.client_id
    WHERE d.status = 'won' AND d.closed_at >= ${pp.start}
    ORDER BY d.closed_at DESC, d.created_at DESC
    LIMIT 20
  `;

  return NextResponse.json({
    payPeriod: pp,
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
