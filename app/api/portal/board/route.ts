import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getPortalSession } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';

// GET — hent kundens projekt-board (read-only)
export async function GET() {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const rows = await sql`
    SELECT portal_board_id FROM customers WHERE id = ${session.id} LIMIT 1
  ` as unknown as Array<{ portal_board_id: string | null }>;

  const boardId = rows[0]?.portal_board_id;
  if (!boardId) return NextResponse.json(null);

  const [board] = await sql`
    SELECT pb.id, pb.name, pb.color, pb.description, pb.updated_at
    FROM project_boards pb
    WHERE pb.id = ${boardId}
  ` as unknown as Array<{ id: string; name: string; color: string; description: string | null; updated_at: string }>;

  if (!board) return NextResponse.json(null);

  const columns = await sql`
    SELECT id, name, color, position FROM project_columns
    WHERE board_id = ${boardId}
    ORDER BY position ASC
  `;

  const tasks = await sql`
    SELECT
      pt.id, pt.column_id, pt.title, pt.description,
      pt.priority, pt.due_date, pt.labels, pt.done,
      u.name AS assigned_name
    FROM project_tasks pt
    LEFT JOIN users u ON pt.assigned_to = u.id
    WHERE pt.board_id = ${boardId}
    ORDER BY pt.position ASC
  `;

  return NextResponse.json({ board, columns, tasks });
}
