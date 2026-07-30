import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import { getBoardAccess, canEdit } from '@/lib/boards';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const access = await getBoardAccess(session, id);
  if (!access || !canEdit(access.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { order } = await req.json() as { order: number[] };
  if (!Array.isArray(order)) return NextResponse.json({ error: 'order kræves' }, { status: 400 });

  for (let i = 0; i < order.length; i++) {
    await sql`UPDATE board_lists SET position = ${i} WHERE id = ${order[i]} AND board_id = ${id}`;
  }
  return NextResponse.json({ ok: true });
}
