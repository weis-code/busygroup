import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import { getBoardAccess, canEdit } from '@/lib/boards';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; listId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, listId } = await params;

  const access = await getBoardAccess(session, id);
  if (!access || !canEdit(access.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [current] = await sql`SELECT * FROM board_lists WHERE id = ${listId} AND board_id = ${id}`;
  if (!current) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  const body = await req.json();
  const title = 'title' in body ? body.title : current.title;
  const position = 'position' in body ? body.position : current.position;
  const color = 'color' in body ? body.color : current.color;
  const isArchived = 'is_archived' in body ? body.is_archived : current.is_archived;

  const [updated] = await sql`
    UPDATE board_lists SET title = ${title}, position = ${position}, color = ${color}, is_archived = ${isArchived}
    WHERE id = ${listId} RETURNING *
  `;
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; listId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, listId } = await params;

  const access = await getBoardAccess(session, id);
  if (!access || !canEdit(access.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await sql`UPDATE board_lists SET is_archived = true WHERE id = ${listId} AND board_id = ${id}`;
  await sql`UPDATE board_cards SET is_archived = true WHERE list_id = ${listId} AND board_id = ${id}`;
  return NextResponse.json({ ok: true });
}
