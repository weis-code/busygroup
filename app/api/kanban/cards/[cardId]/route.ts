import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cardId } = await params;
  const body = await req.json();

  const [card] = await sql`
    UPDATE kanban_cards SET
      column_id    = COALESCE(${body.column_id ?? null}, column_id),
      title        = COALESCE(${body.title ?? null}, title),
      description  = COALESCE(${body.description ?? null}, description),
      assigned_to  = COALESCE(${body.assigned_to ?? null}, assigned_to),
      priority     = COALESCE(${body.priority ?? null}, priority),
      due_date     = COALESCE(${body.due_date ?? null}, due_date),
      position     = COALESCE(${body.position ?? null}, position),
      completed_at = COALESCE(${body.completed_at ?? null}, completed_at),
      updated_at   = NOW()
    WHERE id = ${cardId}
    RETURNING *
  `;
  return NextResponse.json(card);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cardId } = await params;
  await sql`DELETE FROM kanban_cards WHERE id = ${cardId}`;
  return NextResponse.json({ ok: true });
}
