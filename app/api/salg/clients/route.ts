import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const clients = await sql`
    SELECT
      c.*,
      COUNT(DISTINCT d.id)                          AS deal_count,
      COALESCE(SUM(d.deal_value), 0)                AS total_revenue,
      COALESCE(SUM(CASE WHEN d.closed_at >= date_trunc('month', NOW())::text
                        THEN d.deal_value END), 0)  AS month_revenue
    FROM sc_clients c
    LEFT JOIN sc_deals d ON d.client_id = c.id AND d.status = 'won'
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `;
  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const { name, description, type, color } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Navn er påkrævet' }, { status: 400 });

  const now = new Date().toISOString();
  const id = randomUUID();
  await sql`
    INSERT INTO sc_clients (id, name, description, type, color, created_by, created_at, updated_at)
    VALUES (${id}, ${name.trim()}, ${description || null}, ${type || 'sales'}, ${color || '#3498DB'}, ${session.id}, ${now}, ${now})
  `;
  const [client] = await sql`SELECT * FROM sc_clients WHERE id = ${id}`;
  return NextResponse.json(client, { status: 201 });
}
