import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const boardId = req.nextUrl.searchParams.get('boardId');
  if (!boardId) return NextResponse.json({ error: 'boardId kræves' }, { status: 400 });

  await sql`ALTER TABLE kanban_cards ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL`.catch(() => {});

  const cards = await sql`
    SELECT kc.*, u.name AS assigned_name, co.name AS company_name, co.color AS company_color
    FROM kanban_cards kc
    LEFT JOIN users u ON u.id = kc.assigned_to
    LEFT JOIN companies co ON co.id = kc.company_id
    WHERE kc.board_id = ${boardId}
    ORDER BY kc.position
  `;
  return NextResponse.json(cards);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { column_id, board_id, title, description, assigned_to, priority, due_date, company_id } = await req.json();
  if (!column_id || !board_id || !title) {
    return NextResponse.json({ error: 'column_id, board_id og title kræves' }, { status: 400 });
  }

  const [{ max_pos }] = await sql`
    SELECT COALESCE(MAX(position), -1) AS max_pos FROM kanban_cards WHERE column_id = ${column_id}
  `;
  const [card] = await sql`
    INSERT INTO kanban_cards (column_id, board_id, title, description, assigned_to, created_by, priority, due_date, position, company_id)
    VALUES (${column_id}, ${board_id}, ${title}, ${description ?? null}, ${assigned_to ?? null}, ${session.id}, ${priority ?? 'normal'}, ${due_date ?? null}, ${(max_pos as number) + 1}, ${company_id ?? null})
    RETURNING *
  `;
  return NextResponse.json(card, { status: 201 });
}
