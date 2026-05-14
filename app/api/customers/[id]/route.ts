export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const [row] = await sql`SELECT * FROM customers WHERE id = ${params.id}`;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const [existing] = await sql`SELECT * FROM customers WHERE id = ${params.id}`;
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const now = new Date().toISOString();
    await sql`
      UPDATE customers SET
        company = ${body.company ?? existing.company},
        contact_name = ${body.contact_name ?? existing.contact_name},
        contact_title = ${body.contact_title ?? existing.contact_title},
        contact_email = ${body.contact_email ?? existing.contact_email},
        contact_phone = ${body.contact_phone ?? existing.contact_phone},
        market = ${body.market ?? existing.market},
        mrr = ${body.mrr ?? existing.mrr},
        contract_start = ${body.contract_start ?? existing.contract_start},
        contract_end = ${body.contract_end ?? existing.contract_end},
        churn_risk = ${body.churn_risk ?? existing.churn_risk},
        health_score = ${body.health_score ?? existing.health_score},
        segment = ${body.segment ?? existing.segment},
        notes = ${body.notes ?? existing.notes},
        active = ${body.active !== undefined ? body.active : existing.active},
        updated_at = ${now}
      WHERE id = ${params.id}
    `;
    const [updated] = await sql`SELECT * FROM customers WHERE id = ${params.id}`;
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await sql`DELETE FROM customer_products WHERE customer_id = ${params.id}`;
    await sql`DELETE FROM customer_notes WHERE customer_id = ${params.id}`;
    await sql`DELETE FROM customers WHERE id = ${params.id}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
