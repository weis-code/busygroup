import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import { getBoardAccess, canEdit } from '@/lib/boards';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const access = await getBoardAccess(session, id);
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const lists = await sql`SELECT * FROM board_lists WHERE board_id = ${id} AND is_archived = false ORDER BY position`;
  return NextResponse.json(lists);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const access = await getBoardAccess(session, id);
  if (!access || !canEdit(access.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { title, position } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: 'Titel kræves' }, { status: 400 });

  let pos = position;
  if (pos == null) {
    const [{ max_pos }] = await sql`SELECT COALESCE(MAX(position), -1) AS max_pos FROM board_lists WHERE board_id = ${id}`;
    pos = Number(max_pos) + 1;
  }

  const [list] = await sql`
    INSERT INTO board_lists (board_id, title, position) VALUES (${id}, ${title.trim()}, ${pos}) RETURNING *
  `;
  return NextResponse.json(list, { status: 201 });
}
