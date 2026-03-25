export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const role = req.headers.get('x-user-role');
    const userId = req.headers.get('x-user-id');

    const rows = await sql`
      SELECT c.*,
        COALESCE(SUM(CASE WHEN p.type='mrr' THEN p.price ELSE 0 END), 0) AS mrr_calculated,
        STRING_AGG(p.name, ', ') AS product_names
      FROM customers c
      LEFT JOIN customer_products cp ON cp.customer_id = c.id
      LEFT JOIN products p ON p.id = cp.product_id
      ${role === 'seller' && userId ? sql`WHERE c.assigned_to = ${userId}` : sql``}
      GROUP BY c.id
      ORDER BY c.mrr DESC, c.company ASC
    `;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const now = new Date().toISOString();
    const id = randomUUID();

    // Auto-assign to creating user
    const userId = req.headers.get('x-user-id');
    const assignedTo = body.assigned_to || userId || null;

    await sql`
      INSERT INTO customers (id, company, contact_name, contact_title, contact_email, contact_phone, market, mrr, contract_start, contract_end, churn_risk, health_score, segment, notes, assigned_to, created_at, updated_at)
      VALUES (${id}, ${body.company || ''}, ${body.contact_name || ''}, ${body.contact_title || ''}, ${body.contact_email || ''}, ${body.contact_phone || ''}, ${body.market || 'denmark'}, ${body.mrr || 0}, ${body.contract_start || null}, ${body.contract_end || null}, ${body.churn_risk || 'low'}, ${body.health_score ?? 80}, ${body.segment || 'smb'}, ${body.notes || ''}, ${assignedTo}, ${now}, ${now})
    `;
    const [created] = await sql`SELECT * FROM customers WHERE id = ${id}`;
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
