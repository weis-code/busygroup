import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  const items = await sql`
    SELECT * FROM kanban_card_checklist WHERE card_id = ${cardId} ORDER BY position
  `;
  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cardId } = await params;
  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: 'text kræves' }, { status: 400 });

  const [{ max_pos }] = await sql`
    SELECT COALESCE(MAX(position), -1) AS max_pos FROM kanban_card_checklist WHERE card_id = ${cardId}
  `;
  const [item] = await sql`
    INSERT INTO kanban_card_checklist (card_id, text, position)
    VALUES (${cardId}, ${text.trim()}, ${(max_pos as number) + 1})
    RETURNING *
  `;
  return NextResponse.json(item, { status: 201 });
}
