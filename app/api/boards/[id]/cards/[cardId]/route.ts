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

  const [card] = await sql`SELECT * FROM board_cards WHERE id = ${cardId} AND board_id = ${id}`;
  if (!card) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  const [comments, activity] = await Promise.all([
    sql`
      SELECT c.*, u.name AS author_name
      FROM board_card_comments c JOIN users u ON u.id = c.author_id
      WHERE c.card_id = ${cardId} ORDER BY c.created_at
    `,
    sql`
      SELECT a.*, u.name AS user_name
      FROM board_card_activity a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.card_id = ${cardId} ORDER BY a.created_at
    `,
  ]);

  return NextResponse.json({ ...card, comments, activity });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; cardId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, cardId } = await params;

  const access = await getBoardAccess(session, id);
  if (!access || !canEdit(access.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [current] = await sql`SELECT * FROM board_cards WHERE id = ${cardId} AND board_id = ${id}`;
  if (!current) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  const body = await req.json();
  const merged = {
    title: 'title' in body ? body.title : current.title,
    description: 'description' in body ? body.description : current.description,
    list_id: 'list_id' in body ? body.list_id : current.list_id,
    position: 'position' in body ? body.position : current.position,
    assignees: 'assignees' in body ? body.assignees : current.assignees,
    labels: 'labels' in body ? body.labels : current.labels,
    due_date: 'due_date' in body ? body.due_date : current.due_date,
    start_date: 'start_date' in body ? body.start_date : current.start_date,
    cover_color: 'cover_color' in body ? body.cover_color : current.cover_color,
    priority: 'priority' in body ? body.priority : current.priority,
    checklist: 'checklist' in body ? body.checklist : current.checklist,
    is_archived: 'is_archived' in body ? body.is_archived : current.is_archived,
  };

  const [updated] = await sql`
    UPDATE board_cards SET
      title = ${merged.title}, description = ${merged.description},
      list_id = ${merged.list_id}, position = ${merged.position},
      assignees = ${sql.json(merged.assignees ?? [])}, labels = ${sql.json(merged.labels ?? [])},
      due_date = ${merged.due_date}, start_date = ${merged.start_date},
      cover_color = ${merged.cover_color}, priority = ${merged.priority},
      checklist = ${sql.json(merged.checklist ?? [])}, is_archived = ${merged.is_archived},
      updated_at = NOW()
    WHERE id = ${cardId}
    RETURNING *
  `;

  if ('list_id' in body && body.list_id !== current.list_id) {
    await logActivity(Number(cardId), Number(id), session.id, 'moved', { from_list: current.list_id, to_list: body.list_id });
  }
  if ('title' in body && body.title !== current.title) {
    await logActivity(Number(cardId), Number(id), session.id, 'renamed', { from: current.title, to: body.title });
  }
  if ('assignees' in body) {
    await logActivity(Number(cardId), Number(id), session.id, 'assigned', { assignees: body.assignees });
  }
  if ('due_date' in body && body.due_date !== current.due_date) {
    await logActivity(Number(cardId), Number(id), session.id, 'due_date_set', { due_date: body.due_date });
  }
  if ('labels' in body) {
    await logActivity(Number(cardId), Number(id), session.id, 'label_added', { labels: body.labels });
  }
  if ('is_archived' in body && body.is_archived && !current.is_archived) {
    await logActivity(Number(cardId), Number(id), session.id, 'archived');
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; cardId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, cardId } = await params;

  const access = await getBoardAccess(session, id);
  if (!access || !canEdit(access.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await sql`UPDATE board_cards SET is_archived = true, updated_at = NOW() WHERE id = ${cardId} AND board_id = ${id}`;
  await logActivity(Number(cardId), Number(id), session.id, 'archived');
  return NextResponse.json({ ok: true });
}
