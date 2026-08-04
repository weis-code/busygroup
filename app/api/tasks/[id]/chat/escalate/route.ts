import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import { userCanAccessTask } from '@/lib/tasks';
import { ensureMessengerTables, getOrCreateDmConversation } from '@/lib/messenger';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!(await userCanAccessTask(session, id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { question } = await req.json() as { question?: string };
  if (!question?.trim()) return NextResponse.json({ error: 'question kræves' }, { status: 400 });

  const [task] = await sql`SELECT id, name, client FROM tasks WHERE id = ${id}`;
  if (!task) return NextResponse.json({ error: 'Opgave ikke fundet' }, { status: 404 });

  const [entry] = await sql`
    INSERT INTO task_assistant_questions (task_id, seller_id, question)
    VALUES (${id}, ${session.id}, ${question.trim()})
    RETURNING id, task_id, question, status, created_at
  `;

  const admins = await sql`SELECT id FROM users WHERE role = 'ADMIN'`;
  if (admins.length > 0) {
    await ensureMessengerTables();
    const body = `🤖 Opgave-assistent — ${session.name} spurgte om noget assistenten ikke kunne svare på (opgave "${task.name}" · ${task.client}):\n\n"${question.trim()}"\n\nSvar under Opgave-assistent → Ubesvarede spørgsmål.`;
    for (const admin of admins) {
      if (admin.id === session.id) continue;
      const convId = await getOrCreateDmConversation(session.id, admin.id);
      await sql`INSERT INTO messenger_messages (dm_conversation_id, sender_id, body) VALUES (${convId}, ${session.id}, ${body})`;
    }
  }

  return NextResponse.json(entry, { status: 201 });
}
