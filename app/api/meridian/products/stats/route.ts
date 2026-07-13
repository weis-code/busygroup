import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const product = searchParams.get('product');
  if (!product) return NextResponse.json({ error: 'product required' }, { status: 400 });

  const thisMonth  = new Date().toISOString().slice(0, 7) + '-01';
  const today      = new Date().toISOString().slice(0, 10);

  const [mrrRow] = await sql`
    SELECT COALESCE(SUM(cp.price_dkk), 0)::int AS mrr
    FROM customer_products cp
    WHERE cp.product_name = ${product} AND cp.status = 'active'
  `;

  const [activeRow] = await sql`
    SELECT COUNT(DISTINCT cp.customer_id)::int AS count
    FROM customer_products cp
    WHERE cp.product_name = ${product} AND cp.status = 'active'
  `;

  const [newRow] = await sql`
    SELECT COUNT(*)::int AS count
    FROM customer_products cp
    WHERE cp.product_name = ${product}
      AND cp.status = 'active'
      AND cp.started_at >= ${thisMonth}::date
      AND cp.started_at <= ${today}::date
  `;

  const customers = await sql`
    SELECT cu.id, cu.name, cu.contact_name, cu.status,
           cu.mrr, cu.created_at,
           cp.price_dkk, cp.started_at
    FROM customer_products cp
    JOIN customers cu ON cu.id = cp.customer_id
    WHERE cp.product_name = ${product} AND cp.status = 'active'
    ORDER BY cu.name
  `;

  return NextResponse.json({
    mrr:         mrrRow.mrr,
    activeCount: activeRow.count,
    newThisMonth: newRow.count,
    customers,
  });
}
