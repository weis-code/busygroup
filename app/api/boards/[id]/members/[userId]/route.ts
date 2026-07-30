import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import { getBoardAccess, canManageBoard } from '@/lib/boards';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, userId } = await params;

  const access = await getBoardAccess(session, id);
  if (!access || !canManageBoard(access.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { role } = await req.json();
  if (!['admin', 'member', 'viewer'].includes(role)) return NextResponse.json({ error: 'Ugyldig rolle' }, { status: 400 });

  const [updated] = await sql`
    UPDATE board_members SET role = ${role} WHERE board_id = ${id} AND user_id = ${userId} RETURNING *
  `;
  if (!updated) return NextResponse.json({ error: 'Medlem ikke fundet' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, userId } = await params;

  const access = await getBoardAccess(session, id);
  if (!access || !canManageBoard(access.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const board = access.board as Record<string, unknown>;
  if (board.owner_id === userId) return NextResponse.json({ error: 'Ejeren kan ikke fjernes' }, { status: 400 });

  await sql`DELETE FROM board_members WHERE board_id = ${id} AND user_id = ${userId}`;
  return NextResponse.json({ ok: true });
}
