import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import { ensureMessengerTables, getOrCreateDmConversation } from '@/lib/messenger';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;

  const { answer } = await req.json() as { answer?: string };
  if (!answer?.trim()) return NextResponse.json({ error: 'answer kræves' }, { status: 400 });

  const [question] = await sql`
    SELECT q.id, q.task_id, q.seller_id, q.question, t.name AS task_name, t.client AS task_client
    FROM task_assistant_questions q
    JOIN tasks t ON t.id = q.task_id
    WHERE q.id = ${id}
  `;
  if (!question) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  const [updated] = await sql`
    UPDATE task_assistant_questions
    SET answer = ${answer.trim()}, status = 'answered', answered_by = ${session.id}, answered_at = NOW()
    WHERE id = ${id}
    RETURNING id, task_id, question, answer, status, answered_at
  `;

  // Surface the answer directly in the seller's assistant chat for that task.
  await sql`
    INSERT INTO task_chat_messages (task_id, user_id, role, content)
    VALUES (${question.task_id}, ${question.seller_id}, 'assistant', ${`💬 Svar fra admin på dit spørgsmål "${question.question}":\n\n${answer.trim()}`})
  `;

  // Also ping the seller in the messenger so they notice.
  if (question.seller_id !== session.id) {
    await ensureMessengerTables();
    const convId = await getOrCreateDmConversation(session.id, question.seller_id);
    const body = `🤖 Du fik svar på dit spørgsmål om opgave "${question.task_name}" (${question.task_client}) — se det i Opgave-assistenten.`;
    await sql`INSERT INTO messenger_messages (dm_conversation_id, sender_id, body) VALUES (${convId}, ${session.id}, ${body})`;
  }

  return NextResponse.json(updated);
}
