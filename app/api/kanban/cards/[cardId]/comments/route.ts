import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  const comments = await sql`
    SELECT * FROM kanban_card_comments WHERE card_id = ${cardId} ORDER BY created_at
  `;
  return NextResponse.json(comments);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cardId } = await params;
  const { body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: 'body kræves' }, { status: 400 });

  const [{ name: userName }] = await sql`SELECT name FROM users WHERE id = ${session.id}`;

  const [comment] = await sql`
    INSERT INTO kanban_card_comments (card_id, user_id, user_name, body)
    VALUES (${cardId}, ${session.id}, ${userName ?? 'Ukendt'}, ${body.trim()})
    RETURNING *
  `;
  return NextResponse.json(comment, { status: 201 });
}
