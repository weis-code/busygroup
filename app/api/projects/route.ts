import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

// GET — list boards the current user can access
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const boards = await sql`
    SELECT
      pb.*,
      u.name  AS owner_name,
      c.company AS customer_company,
      (SELECT COUNT(*) FROM project_tasks pt WHERE pt.board_id = pb.id) AS task_count,
      (SELECT COUNT(*) FROM project_board_members pm WHERE pm.board_id = pb.id) AS member_count
    FROM project_boards pb
    LEFT JOIN users u     ON pb.owner_id    = u.id
    LEFT JOIN customers c ON pb.customer_id = c.id
    WHERE
      pb.visibility = 'team'
      OR pb.owner_id = ${session.id}
      OR EXISTS (
        SELECT 1 FROM project_board_members pm
        WHERE pm.board_id = pb.id AND pm.user_id = ${session.id}
      )
    ORDER BY pb.updated_at DESC
  `;

  return NextResponse.json(boards);
}

// POST — create new board
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const { name, description = '', visibility = 'private', color = '#E84025', customer_id = null, members = [] } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Navn er påkrævet' }, { status: 400 });

  const id  = randomUUID();
  const now = new Date().toISOString();

  await sql`
    INSERT INTO project_boards (id, name, description, owner_id, visibility, color, customer_id, created_at, updated_at)
    VALUES (${id}, ${name.trim()}, ${description}, ${session.id}, ${visibility}, ${color}, ${customer_id}, ${now}, ${now})
  `;

  // Owner is always a member
  await sql`
    INSERT INTO project_board_members (id, board_id, user_id, role)
    VALUES (${randomUUID()}, ${id}, ${session.id}, 'owner')
    ON CONFLICT (board_id, user_id) DO NOTHING
  `;

  // Add invited members
  for (const userId of members as string[]) {
    if (userId !== session.id) {
      await sql`
        INSERT INTO project_board_members (id, board_id, user_id, role)
        VALUES (${randomUUID()}, ${id}, ${userId}, 'member')
        ON CONFLICT (board_id, user_id) DO NOTHING
      `;
    }
  }

  // Seed default columns
  const defaultCols = ['To do', 'I gang', 'Review', 'Færdig'];
  for (let i = 0; i < defaultCols.length; i++) {
    await sql`
      INSERT INTO project_columns (id, board_id, name, position, color, created_at)
      VALUES (${randomUUID()}, ${id}, ${defaultCols[i]}, ${i}, '#334455', ${now})
    `;
  }

  return NextResponse.json({ id, name, visibility, color }, { status: 201 });
}
