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
    WHERE active = 1 OR active = true
    ORDER BY type ASC, price DESC
  ` as unknown as Array<{ id: string; name: string; description: string | null; price: number; type: string; currency: string }>;

  const owned = await sql`
    SELECT product_id FROM customer_products WHERE customer_id = ${session.id}
  ` as unknown as Array<{ product_id: string }>;

  const ownedIds = new Set(owned.map(r => r.product_id));

  return NextResponse.json({
    owned: allProducts.filter(p => ownedIds.has(p.id)),
    available: allProducts.filter(p => !ownedIds.has(p.id)),
  });
}
