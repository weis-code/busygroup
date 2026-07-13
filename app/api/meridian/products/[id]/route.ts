import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as { price_dkk?: number; status?: string; started_at?: string };

  const [row] = await sql`
    UPDATE customer_products SET
      price_dkk  = COALESCE(${body.price_dkk ?? null}, price_dkk),
      status     = COALESCE(${body.status ?? null}, status),
      started_at = COALESCE(${body.started_at ?? null}::date, started_at)
    WHERE id = ${id}
    RETURNING *
  `;
  if (!row) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  await sql`
    UPDATE customers SET
      mrr = (SELECT COALESCE(SUM(price_dkk), 0) FROM customer_products WHERE customer_id = ${row.customer_id} AND status = 'active')
    WHERE id = ${row.customer_id}
  `;

  return NextResponse.json(row);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const [row] = await sql`DELETE FROM customer_products WHERE id = ${id} RETURNING customer_id`;
  if (!row) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  await sql`
    UPDATE customers SET
      mrr = (SELECT COALESCE(SUM(price_dkk), 0) FROM customer_products WHERE customer_id = ${row.customer_id} AND status = 'active')
    WHERE id = ${row.customer_id}
  `;

  return new NextResponse(null, { status: 204 });
}
