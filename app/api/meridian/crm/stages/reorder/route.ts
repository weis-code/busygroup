import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { order } = await req.json() as { order: number[] };
  if (!Array.isArray(order)) {
    return NextResponse.json({ error: 'order array required' }, { status: 400 });
  }
  for (let i = 0; i < order.length; i++) {
    await sql`
      UPDATE crm_pipeline_stages
      SET position = ${i}
      WHERE id = ${order[i]} AND owner_id = ${session.id} AND workspace_id = (SELECT id FROM companies WHERE slug = 'meridian')
    `;
  }
  return NextResponse.json({ ok: true });
}
