import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getPortalSession } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  // Fetch project boards linked to this customer
  const boards = await sql`
    SELECT
      pb.id, pb.name, pb.description, pb.color, pb.updated_at,
      (SELECT COUNT(*)::int FROM project_tasks pt WHERE pt.board_id = pb.id) AS task_count,
      (SELECT COUNT(*)::int FROM project_tasks pt WHERE pt.board_id = pb.id AND pt.customer_id = ${session.id}) AS customer_task_count
    FROM project_boards pb
    WHERE pb.customer_id = ${session.id}
    ORDER BY pb.updated_at DESC
  ` as unknown as Array<{
    id: string; name: string; description: string | null;
    color: string; updated_at: string;
    task_count: number; customer_task_count: number;
  }>;

  // For each board, get columns + tasks
  const result = await Promise.all(boards.map(async (board) => {
    const columns = await sql`
      SELECT pc.id, pc.name, pc.color, pc.position
      FROM project_columns pc
      WHERE pc.board_id = ${board.id}
      ORDER BY pc.position ASC
    ` as unknown as Array<{ id: string; name: string; color: string; position: number }>;

    const tasks = await sql`
      SELECT
        pt.id, pt.title, pt.description, pt.priority, pt.due_date,
        pt.labels, pt.column_id, pt.position,
        u.name AS assigned_name
      FROM project_tasks pt
      LEFT JOIN users u ON pt.assigned_to = u.id
      WHERE pt.board_id = ${board.id}
      ORDER BY pt.position ASC
    ` as unknown as Array<{
      id: string; title: string; description: string | null;
      priority: string; due_date: string | null; labels: string;
      column_id: string; position: number; assigned_name: string | null;
    }>;

    return { ...board, columns, tasks };
  }));

  return NextResponse.json(result);
}
