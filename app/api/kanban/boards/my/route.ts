import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

const DEFAULT_COLUMNS = [
  { name: 'Need',        color: '#f43f5e', position: 0 },
  { name: 'Nice',        color: '#f59e0b', position: 1 },
  { name: 'In progress', color: '#4f8ef7', position: 2 },
  { name: 'Done',        color: '#2dd4a0', position: 3 },
];

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let [board] = await sql`
    SELECT * FROM kanban_boards WHERE owner_user_id = ${session.id} LIMIT 1
  `;

  if (!board) {
    [board] = await sql`
      INSERT INTO kanban_boards (name, owner_user_id)
      VALUES ('Mit board', ${session.id})
      RETURNING *
    `;
    for (const col of DEFAULT_COLUMNS) {
      await sql`
        INSERT INTO kanban_columns (board_id, name, position, color)
        VALUES (${board.id}, ${col.name}, ${col.position}, ${col.color})
      `;
    }
  }

  return NextResponse.json(board);
}
