import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import { getBoardAccess, canEdit, logActivity } from '@/lib/boards';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const access = await getBoardAccess(session, id);
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const cards = await sql`
    SELECT bc.*, (SELECT COUNT(*) FROM board_card_comments WHERE card_id = bc.id)::int AS comment_count
    FROM board_cards bc WHERE bc.board_id = ${id} AND bc.is_archived = false ORDER BY bc.list_id, bc.position
  `;
  return NextResponse.json(cards);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const access = await getBoardAccess(session, id);
  if (!access || !canEdit(access.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { list_id, title, position } = await req.json();
  if (!list_id || !title?.trim()) return NextResponse.json({ error: 'list_id og title kræves' }, { status: 400 });

  let pos = position;
  if (pos == null) {
    const [{ max_pos }] = await sql`SELECT COALESCE(MAX(position), -1) AS max_pos FROM board_cards WHERE list_id = ${list_id}`;
    pos = Number(max_pos) + 1;
  }

  const [card] = await sql`
    INSERT INTO board_cards (list_id, board_id, title, position, created_by)
    VALUES (${list_id}, ${id}, ${title.trim()}, ${pos}, ${session.id})
    RETURNING *
  `;
  await logActivity(card.id, Number(id), session.id, 'created');
  return NextResponse.json(card, { status: 201 });
}
