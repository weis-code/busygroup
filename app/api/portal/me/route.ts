import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getPortalSession } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const rows = await sql`
    SELECT
      c.id, c.company, c.contact_name, c.contact_title, c.contact_email,
      c.contact_phone, c.market, c.mrr, c.contract_start, c.contract_end,
      c.health_score, c.segment, c.notes, c.portal_email,
      COALESCE(
        (SELECT string_agg(p.name, ', ' ORDER BY p.name)
         FROM customer_products cp
         JOIN products p ON p.id = cp.product_id
         WHERE cp.customer_id = c.id),
        ''
      ) AS product_names,
      COALESCE(
        (SELECT json_agg(json_build_object('id', p.id, 'name', p.name, 'price', p.price, 'type', p.type, 'currency', p.currency))
         FROM customer_products cp
         JOIN products p ON p.id = cp.product_id
         WHERE cp.customer_id = c.id),
        '[]'::json
      ) AS products
    FROM customers c
    WHERE c.id = ${session.id}
    LIMIT 1
  ` as unknown as Array<Record<string, unknown>>;

  if (!rows[0]) return NextResponse.json({ error: 'Kunde ikke fundet' }, { status: 404 });

  return NextResponse.json(rows[0]);
}
