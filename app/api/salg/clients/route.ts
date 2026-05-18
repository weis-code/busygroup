import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const includeInactive = new URL(req.url).searchParams.get('include_inactive') === '1';
  const period = new Date().toISOString().slice(0, 7);

  // For sellers: only return opgaver they're assigned to (or all if no assignments exist)
  // For admin: return all (filtered by active unless include_inactive)
  let clients;
  if (session.role === 'admin') {
    clients = await sql`
      SELECT
        c.*,
        COUNT(DISTINCT d.id)               AS deal_count,
        COALESCE(SUM(d.deal_value), 0)     AS total_revenue,
        COALESCE(SUM(CASE WHEN d.closed_at LIKE ${period + '%'} THEN d.deal_value END), 0) AS month_revenue,
        COALESCE(SUM(
          CASE c.revenue_model
            WHEN 'fixed'      THEN c.revenue_fixed
            WHEN 'percentage' THEN ROUND(d.deal_value * c.revenue_pct / 100)
            ELSE d.deal_value
          END
        ), 0) AS total_house_revenue,
        COALESCE(SUM(CASE WHEN d.closed_at LIKE ${period + '%'} THEN
          CASE c.revenue_model
            WHEN 'fixed'      THEN c.revenue_fixed
            WHEN 'percentage' THEN ROUND(d.deal_value * c.revenue_pct / 100)
            ELSE d.deal_value
          END
        END), 0) AS month_house_revenue
      FROM sc_clients c
      LEFT JOIN sc_deals d ON d.client_id = c.id AND d.status = 'won'
      WHERE ${includeInactive ? sql`true` : sql`c.active = true`}
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `;
  } else {
    // Seller: active opgaver assigned to them (or all active if no sc_client_sellers rows exist for client)
    clients = await sql`
      SELECT
        c.*,
        COUNT(DISTINCT d.id)           AS deal_count,
        COALESCE(SUM(d.deal_value), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN d.closed_at LIKE ${period + '%'} THEN d.deal_value END), 0) AS month_revenue,
        0 AS total_house_revenue,
        0 AS month_house_revenue
      FROM sc_clients c
      LEFT JOIN sc_deals d ON d.client_id = c.id AND d.status = 'won' AND d.salesperson_id = ${session.id}
      WHERE c.active = true
        AND (
          NOT EXISTS (SELECT 1 FROM sc_client_sellers WHERE client_id = c.id)
          OR EXISTS (SELECT 1 FROM sc_client_sellers WHERE client_id = c.id AND user_id = ${session.id})
        )
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `;
  }

  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Kun admin' }, { status: 403 });

  const { name, description, type, color } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Navn er påkrævet' }, { status: 400 });

  const now = new Date().toISOString();
  const id = randomUUID();
  await sql`
    INSERT INTO sc_clients (id, name, description, type, color, active, revenue_model, revenue_fixed, revenue_pct, created_by, created_at, updated_at)
    VALUES (${id}, ${name.trim()}, ${description || null}, ${type || 'sales'}, ${color || '#3498DB'}, true, 'none', 0, 0, ${session.id}, ${now}, ${now})
  `;
  const [client] = await sql`SELECT * FROM sc_clients WHERE id = ${id}`;
  return NextResponse.json(client, { status: 201 });
}
