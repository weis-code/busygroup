import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Merge crm_products + Mine Kunder (owner_products)
  // Negative IDs mark owner_products so the deals API can look them up in the right table
  type PRow = { id: number; name: string; price: number | null; type: string };

  let crmRows: PRow[] = [];
  try {
    crmRows = (await sql`
      SELECT id, name, price, type FROM crm_products
      WHERE owner_id = ${session.id} AND active = TRUE
    `) as unknown as PRow[];
  } catch { /* table not yet created — migration pending */ }

  let ownerRows: PRow[] = [];
  try {
    const raw = (await sql`
      SELECT id, name, price, type FROM owner_products
      WHERE owner_id = ${session.id}
    `) as unknown as PRow[];
    ownerRows = raw.map(p => ({
      ...p,
      id: -p.id,
      type: p.type === 'onetime' ? 'one_time' : p.type,
    }));
  } catch { /* table not yet created */ }

  const all = [...crmRows, ...ownerRows].sort((a, b) => a.name.localeCompare(b.name, 'da'));
  return NextResponse.json(all);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { name, price, type, description } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Navn kræves' }, { status: 400 });

  const [product] = await sql`
    INSERT INTO crm_products (owner_id, name, price, type, description)
    VALUES (
      ${session.id},
      ${name.trim()},
      ${price != null ? Number(price) : null},
      ${(type as string) ?? 'monthly'},
      ${description?.trim() ?? null}
    )
    RETURNING *
  `;
  return NextResponse.json(product, { status: 201 });
}
