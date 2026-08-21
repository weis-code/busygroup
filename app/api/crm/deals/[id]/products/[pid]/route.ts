import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; pid: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, pid } = await params;

  // Personal CRM: everyone below ADMIN may only touch products on deals they own.
  if (session.role !== 'ADMIN') {
    const [owned] = await sql`SELECT id FROM crm_deals WHERE id = ${Number(id)} AND owner_id = ${session.id}`;
    if (!owned) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  }

  await sql`
    DELETE FROM crm_deal_products
    WHERE id = ${Number(pid)} AND deal_id = ${Number(id)}
  `;
  return NextResponse.json({ ok: true });
}
