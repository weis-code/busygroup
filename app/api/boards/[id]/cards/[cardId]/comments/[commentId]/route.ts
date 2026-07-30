import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import { getBoardAccess } from '@/lib/boards';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, commentId } = await params;

  const access = await getBoardAccess(session, id);
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [comment] = await sql`SELECT * FROM board_card_comments WHERE id = ${commentId}`;
  if (!comment) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  if (comment.author_id !== session.id) return NextResponse.json({ error: 'Du kan kun redigere dine egne kommentarer' }, { status: 403 });

  const { body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: 'Besked kræves' }, { status: 400 });

  const [updated] = await sql`
    UPDATE board_card_comments SET body = ${body.trim()}, updated_at = NOW() WHERE id = ${commentId} RETURNING *
  `;
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, commentId } = await params;

  const access = await getBoardAccess(session, id);
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [comment] = await sql`SELECT * FROM board_card_comments WHERE id = ${commentId}`;
  if (!comment) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  if (comment.author_id !== session.id && access.role !== 'owner' && access.role !== 'admin') {
    return NextResponse.json({ error: 'Du kan kun slette dine egne kommentarer' }, { status: 403 });
  }

  await sql`DELETE FROM board_card_comments WHERE id = ${commentId}`;
  return NextResponse.json({ ok: true });
}
