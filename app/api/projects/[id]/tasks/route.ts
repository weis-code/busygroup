import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

// POST — create task
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const {
    column_id, title, description = '', assigned_to = null,
    due_date = null, priority = 'medium', labels = '[]', customer_id = null,
  } = await req.json();

  if (!column_id || !title?.trim()) return NextResponse.json({ error: 'column_id og title er påkrævet' }, { status: 400 });

  const [last] = await sql`SELECT MAX(position) AS pos FROM project_tasks WHERE column_id = ${column_id}`;
  const position = (Number((last as unknown as { pos: number | null }).pos ?? -1)) + 1;

  const id  = randomUUID();
  const now = new Date().toISOString();

  await sql`
    INSERT INTO project_tasks
      (id, board_id, column_id, title, description, assigned_to, due_date, priority, labels, position, customer_id, created_by, created_at, updated_at)
    VALUES
      (${id}, ${params.id}, ${column_id}, ${title.trim()}, ${description}, ${assigned_to}, ${due_date}, ${priority}, ${typeof labels === 'string' ? labels : JSON.stringify(labels)}, ${position}, ${customer_id}, ${session.id}, ${now}, ${now})
  `;

  // Notify assigned user via messenger if different from creator
  if (assigned_to && assigned_to !== session.id) {
    try {
      const [board] = await sql`SELECT name FROM project_boards WHERE id = ${params.id}`;
      const boardName = (board as unknown as { name: string })?.name || 'et projekt';

      // Find or create DM conversation between assigner and assignee
      const existing = await sql`
        SELECT cm.conversation_id FROM chat_members cm
        JOIN chat_members cm2 ON cm.conversation_id = cm2.conversation_id AND cm2.user_id = ${assigned_to}
        JOIN chat_conversations cc ON cc.id = cm.conversation_id
        WHERE cm.user_id = ${session.id} AND cc.type = 'direct'
        LIMIT 1
      `;

      let convId: string;
      if (existing.length > 0) {
        convId = (existing[0] as unknown as { conversation_id: string }).conversation_id;
      } else {
        convId = randomUUID();
        await sql`INSERT INTO chat_conversations (id, type, created_by, created_at) VALUES (${convId}, 'direct', ${session.id}, ${now})`;
        await sql`INSERT INTO chat_members (id, conversation_id, user_id, joined_at) VALUES (${randomUUID()}, ${convId}, ${session.id}, ${now})`;
        await sql`INSERT INTO chat_members (id, conversation_id, user_id, joined_at) VALUES (${randomUUID()}, ${convId}, ${assigned_to}, ${now})`;
      }

      const [assigner] = await sql`SELECT name FROM users WHERE id = ${session.id}`;
      const assignerName = (assigner as unknown as { name: string })?.name || 'Nogen';

      await sql`
        INSERT INTO chat_messages (id, conversation_id, sender_id, content, created_at)
        VALUES (${randomUUID()}, ${convId}, ${session.id}, ${`📋 **${assignerName}** har tildelt dig en opgave i *${boardName}*:\n**${title.trim()}**`}, ${now})
      `;
    } catch { /* non-fatal */ }
  }

  const [task] = await sql`
    SELECT pt.*, u.name AS assigned_name, c.company AS customer_company
    FROM project_tasks pt
    LEFT JOIN users u ON pt.assigned_to = u.id
    LEFT JOIN customers c ON pt.customer_id = c.id
    WHERE pt.id = ${id}
  `;

  return NextResponse.json(task, { status: 201 });
}
