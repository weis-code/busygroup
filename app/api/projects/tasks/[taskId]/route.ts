import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

// PATCH — update task (move column, edit fields)
export async function PATCH(req: NextRequest, { params }: { params: { taskId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const body = await req.json();
  const now  = new Date().toISOString();

  const fields = ['title', 'description', 'column_id', 'assigned_to', 'due_date', 'priority', 'labels', 'position', 'customer_id'];
  for (const field of fields) {
    if (field in body) {
      const val = field === 'labels' && typeof body[field] !== 'string' ? JSON.stringify(body[field]) : body[field];
      await sql`UPDATE project_tasks SET ${sql(field)} = ${val}, updated_at = ${now} WHERE id = ${params.taskId}`;
    }
  }

  // Notify if assigned_to changed to a different user
  if ('assigned_to' in body && body.assigned_to && body.assigned_to !== session.id) {
    try {
      const [task] = await sql`SELECT title, board_id FROM project_tasks WHERE id = ${params.taskId}`;
      const t = task as unknown as { title: string; board_id: string };
      const [board] = await sql`SELECT name FROM project_boards WHERE id = ${t.board_id}`;
      const boardName = (board as unknown as { name: string })?.name || 'et projekt';

      const existing = await sql`
        SELECT cm.conversation_id FROM chat_members cm
        JOIN chat_members cm2 ON cm.conversation_id = cm2.conversation_id AND cm2.user_id = ${body.assigned_to}
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
        await sql`INSERT INTO chat_members (id, conversation_id, user_id, joined_at) VALUES (${randomUUID()}, ${convId}, ${body.assigned_to}, ${now})`;
      }

      const [assigner] = await sql`SELECT name FROM users WHERE id = ${session.id}`;
      const assignerName = (assigner as unknown as { name: string })?.name || 'Nogen';

      await sql`
        INSERT INTO chat_messages (id, conversation_id, sender_id, content, created_at)
        VALUES (${randomUUID()}, ${convId}, ${session.id}, ${`📋 **${assignerName}** har tildelt dig en opgave i *${boardName}*:\n**${t.title}**`}, ${now})
      `;
    } catch { /* non-fatal */ }
  }

  const [task] = await sql`
    SELECT pt.*, u.name AS assigned_name, c.company AS customer_company
    FROM project_tasks pt
    LEFT JOIN users u ON pt.assigned_to = u.id
    LEFT JOIN customers c ON pt.customer_id = c.id
    WHERE pt.id = ${params.taskId}
  `;

  return NextResponse.json(task);
}

// DELETE — delete task
export async function DELETE(_req: NextRequest, { params }: { params: { taskId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  await sql`DELETE FROM project_task_comments WHERE task_id = ${params.taskId}`;
  await sql`DELETE FROM project_tasks WHERE id = ${params.taskId}`;
  return NextResponse.json({ ok: true });
}
