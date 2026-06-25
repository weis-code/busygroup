import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { itemId } = await params;
  const { text, completed } = await req.json();

  const [item] = await sql`
    UPDATE kanban_card_checklist SET
      text      = COALESCE(${text ?? null}, text),
      completed = COALESCE(${completed ?? null}, completed)
    WHERE id = ${itemId}
    RETURNING *
  `;
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { itemId } = await params;
  await sql`DELETE FROM kanban_card_checklist WHERE id = ${itemId}`;
  return NextResponse.json({ ok: true });
}
