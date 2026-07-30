import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import { getBoardAccess, canEdit, logActivity } from '@/lib/boards';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; cardId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, cardId } = await params;

  const access = await getBoardAccess(session, id);
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const comments = await sql`
    SELECT c.*, u.name AS author_name
    FROM board_card_comments c JOIN users u ON u.id = c.author_id
    WHERE c.card_id = ${cardId} ORDER BY c.created_at
  `;
  return NextResponse.json(comments);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; cardId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, cardId } = await params;

  const access = await getBoardAccess(session, id);
  if (!access || !canEdit(access.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: 'Besked kræves' }, { status: 400 });

  const [comment] = await sql`
    INSERT INTO board_card_comments (card_id, author_id, body) VALUES (${cardId}, ${session.id}, ${body.trim()}) RETURNING *
  `;
  await logActivity(Number(cardId), Number(id), session.id, 'comment_added', { comment_id: comment.id });
  return NextResponse.json({ ...comment, author_name: session.name }, { status: 201 });
}
