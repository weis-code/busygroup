import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; pid: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, pid } = await params;
  await sql`
    DELETE FROM crm_deal_products
    WHERE id = ${Number(pid)} AND deal_id = ${Number(id)}
  `;
  return NextResponse.json({ ok: true });
}
