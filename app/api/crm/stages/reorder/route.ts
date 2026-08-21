import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { order } = await req.json() as { order: number[] };
  if (!Array.isArray(order)) return NextResponse.json({ error: 'order[] kræves' }, { status: 400 });

  for (let i = 0; i < order.length; i++) {
    await sql`
      UPDATE crm_pipeline_stages SET position = ${i}
      WHERE id = ${order[i]} AND owner_id = ${session.id} AND workspace_id IS NULL
    `;
  }

  return NextResponse.json({ ok: true });
}
