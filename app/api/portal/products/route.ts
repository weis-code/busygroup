import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getPortalSession } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';

// GET — alle produkter + hvilke kunden har
export async function GET() {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const allProducts = await sql`
    SELECT id, name, description, price, type, currency
    FROM products
    WHERE active = 1
    ORDER BY type ASC, price DESC
  ` as unknown as Array<{ id: string; name: string; description: string | null; price: number; type: string; currency: string }>;

  const ownedRows = await sql`
    SELECT
      p.id, p.name, p.description, p.currency,
      COALESCE(cp.custom_price, p.price) AS price,
      COALESCE(cp.custom_type,  p.type)  AS type
    FROM products p
    JOIN customer_products cp ON cp.product_id = p.id
    WHERE cp.customer_id = ${session.id} AND p.active = 1
  ` as unknown as Array<{ id: string; name: string; description: string | null; price: number; type: string; currency: string }>;

  const ownedIds = new Set(ownedRows.map(r => r.id));

  return NextResponse.json({
    owned: ownedRows,
    available: allProducts.filter(p => !ownedIds.has(p.id)),
  });
}
