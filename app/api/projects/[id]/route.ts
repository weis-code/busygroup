import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET — full board with columns + tasks
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const [board] = await sql`
    SELECT pb.*, u.name AS owner_name, c.company AS customer_company
    FROM project_boards pb
    LEFT JOIN users u     ON pb.owner_id    = u.id
    LEFT JOIN customers c ON pb.customer_id = c.id
    WHERE pb.id = ${params.id}
  `;
  if (!board) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  // Access check
  const b = board as unknown as { visibility: string; owner_id: string };
  if (b.visibility !== 'team' && b.owner_id !== session.id) {
    const [mem] = await sql`SELECT id FROM project_board_members WHERE board_id = ${params.id} AND user_id = ${session.id}`;
    if (!mem) return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 });
  }

  const columns = await sql`
    SELECT * FROM project_columns WHERE board_id = ${params.id} ORDER BY position ASC
  `;

  const tasks = await sql`
    SELECT
      pt.*,
      u.name  AS assigned_name,
      c.company AS customer_company
    FROM project_tasks pt
    LEFT JOIN users u     ON pt.assigned_to = u.id
    LEFT JOIN customers c ON pt.customer_id = c.id
    WHERE pt.board_id = ${params.id}
    ORDER BY pt.position ASC
  `;

  const members = await sql`
    SELECT u.id, u.name, u.role AS user_role, pm.role AS board_role
    FROM project_board_members pm
    JOIN users u ON pm.user_id = u.id
    WHERE pm.board_id = ${params.id}
  `;

  return NextResponse.json({ board, columns, tasks, members });
}

// PATCH — update board
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const body = await req.json();
  const now  = new Date().toISOString();
  const fields = ['name', 'description', 'visibility', 'color', 'customer_id'];

  for (const field of fields) {
    if (field in body) {
      await sql`UPDATE project_boards SET ${sql(field)} = ${body[field]}, updated_at = ${now} WHERE id = ${params.id}`;
    }
  }

  // Sync members if provided
  if (Array.isArray(body.members)) {
    // Remove non-owners that are not in new list
    await sql`DELETE FROM project_board_members WHERE board_id = ${params.id} AND role != 'owner'`;
    for (const userId of body.members as string[]) {
      const { randomUUID } = await import('crypto');
      await sql`
        INSERT INTO project_board_members (id, board_id, user_id, role)
        VALUES (${randomUUID()}, ${params.id}, ${userId}, 'member')
        ON CONFLICT (board_id, user_id) DO NOTHING
      `;
    }
  }

  return NextResponse.json({ ok: true });
}

// DELETE — delete board
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const [board] = await sql`SELECT owner_id FROM project_boards WHERE id = ${params.id}`;
  if (!board) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  if ((board as unknown as { owner_id: string }).owner_id !== session.id && session.role !== 'admin') {
    return NextResponse.json({ error: 'Kun ejeren kan slette' }, { status: 403 });
  }

  await sql`DELETE FROM project_boards WHERE id = ${params.id}`;
  return NextResponse.json({ ok: true });
}
