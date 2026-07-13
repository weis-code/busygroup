import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [meridianCo] = await sql`SELECT id FROM companies WHERE slug = 'meridian'`;
  const meridianId: number | null = meridianCo?.id ?? null;

  const products = await sql`
    SELECT
      cp.product_name,
      COUNT(*) FILTER (WHERE cp.status = 'active')::int AS active_count,
      COUNT(*) FILTER (WHERE cp.status != 'active')::int AS inactive_count,
      COALESCE(SUM(cp.price_dkk) FILTER (WHERE cp.status = 'active'), 0)::int AS mrr,
      MIN(cp.started_at) AS first_started,
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'id', cp.id,
          'customer_id', cu.id,
          'customer_name', cu.name,
          'price_dkk', cp.price_dkk,
          'status', cp.status,
          'started_at', cp.started_at
        ) ORDER BY cu.name
      ) AS subscriptions
    FROM customer_products cp
    JOIN customers cu ON cu.id = cp.customer_id
    WHERE cu.company_id = ${meridianId}
    GROUP BY cp.product_name
    ORDER BY mrr DESC, cp.product_name
  `;

  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as { customer_id: number; product_name: string; price_dkk: number; started_at?: string };
  if (!body.customer_id || !body.product_name?.trim()) {
    return NextResponse.json({ error: 'customer_id og product_name kræves' }, { status: 400 });
  }

  const [row] = await sql`
    INSERT INTO customer_products (customer_id, product_name, price_dkk, status, started_at)
    VALUES (${body.customer_id}, ${body.product_name.trim()}, ${body.price_dkk ?? 0}, 'active', ${body.started_at ?? new Date().toISOString().slice(0, 10)})
    RETURNING *
  `;

  // Update customer MRR
  await sql`
    UPDATE customers SET
      mrr = (SELECT COALESCE(SUM(price_dkk), 0) FROM customer_products WHERE customer_id = ${body.customer_id} AND status = 'active')
    WHERE id = ${body.customer_id}
  `;

  return NextResponse.json(row, { status: 201 });
}
