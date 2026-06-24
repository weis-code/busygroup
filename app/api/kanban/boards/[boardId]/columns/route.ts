import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const columns = await sql`
    SELECT * FROM kanban_columns WHERE board_id = ${boardId} ORDER BY position
  `;
  return NextResponse.json(columns);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { boardId } = await params;
  const { name, color } = await req.json();
  if (!name) return NextResponse.json({ error: 'Navn kræves' }, { status: 400 });

  const [{ max_pos }] = await sql`
    SELECT COALESCE(MAX(position), -1) AS max_pos FROM kanban_columns WHERE board_id = ${boardId}
  `;
  const [col] = await sql`
    INSERT INTO kanban_columns (board_id, name, position, color)
    VALUES (${boardId}, ${name}, ${(max_pos as number) + 1}, ${color ?? '#4a5d78'})
    RETURNING *
  `;
  return NextResponse.json(col, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, name, position, color } = await req.json();
  if (!id) return NextResponse.json({ error: 'id kræves' }, { status: 400 });

  const [col] = await sql`
    UPDATE kanban_columns
    SET name = COALESCE(${name ?? null}, name),
        position = COALESCE(${position ?? null}, position),
        color = COALESCE(${color ?? null}, color)
    WHERE id = ${id}
    RETURNING *
  `;
  return NextResponse.json(col);
}

export async function DELETE(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await req.json();
  await sql`DELETE FROM kanban_columns WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
