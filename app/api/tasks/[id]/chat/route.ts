import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { sessionFromRequest } from '@/lib/auth';
import { userCanAccessTask } from '@/lib/tasks';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

const MODEL = 'claude-opus-5';
const MAX_DOC_CHARS = 8000;
const MAX_HISTORY_MESSAGES = 40;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!(await userCanAccessTask(session, id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const messages = await sql`
    SELECT id, role, content, created_at
    FROM task_chat_messages
    WHERE task_id = ${id} AND user_id = ${session.id}
    ORDER BY created_at ASC
  `;
  return NextResponse.json(messages);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!(await userCanAccessTask(session, id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { message } = await req.json() as { message?: string };
  if (!message?.trim()) return NextResponse.json({ error: 'message kræves' }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI-chat er ikke konfigureret (mangler ANTHROPIC_API_KEY)' }, { status: 500 });
  }

  const [task] = await sql`SELECT id, name, client, description, compensation_model FROM tasks WHERE id = ${id}`;
  if (!task) return NextResponse.json({ error: 'Opgave ikke fundet' }, { status: 404 });

  const docs = await sql`
    SELECT filename, extracted_text FROM task_documents
    WHERE task_id = ${id} AND extracted_text IS NOT NULL
  `;
  const docContext = docs.length > 0
    ? docs.map(d => `--- ${d.filename} ---\n${String(d.extracted_text).slice(0, MAX_DOC_CHARS)}`).join('\n\n')
    : 'Ingen dokumenter uploadet endnu for denne opgave.';

  const answeredQuestions = await sql`
    SELECT question, answer FROM task_assistant_questions
    WHERE task_id = ${id} AND status = 'answered'
    ORDER BY answered_at ASC
  `;
  const faqContext = answeredQuestions.length > 0
    ? answeredQuestions.map(q => `Q: ${q.question}\nA: ${q.answer}`).join('\n\n')
    : null;

  const history = await sql`
    SELECT role, content FROM task_chat_messages
    WHERE task_id = ${id} AND user_id = ${session.id}
    ORDER BY created_at ASC
    LIMIT ${MAX_HISTORY_MESSAGES}
  `;

  const systemPrompt = `Du er en assistent for en sælger hos NextLevel Sales. Du hjælper udelukkende med spørgsmål om denne specifikke opgave/kunde, ud fra oplysningerne herunder. Sig tydeligt fra hvis noget ikke fremgår af materialet, i stedet for at gætte. Svar kort og konkret på dansk.

Opgave: ${task.name}
Kunde: ${task.client}
Beskrivelse: ${task.description ?? 'Ingen beskrivelse'}
Kompensationsmodel: ${task.compensation_model}

Uploadede dokumenter:
${docContext}${faqContext ? `\n\nTidligere spørgsmål besvaret af admin (brug disse svar hvis relevante):\n${faqContext}` : ''}`;

  await sql`INSERT INTO task_chat_messages (task_id, user_id, role, content) VALUES (${id}, ${session.id}, 'user', ${message.trim()})`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let replyText: string;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content as string })),
        { role: 'user', content: message.trim() },
      ],
    });
    const textBlock = response.content.find(b => b.type === 'text');
    replyText = textBlock && textBlock.type === 'text' ? textBlock.text : 'Kunne ikke generere et svar.';
  } catch (err) {
    console.error('[tasks/chat] Anthropic call failed:', err);
    return NextResponse.json({ error: 'AI-chatten fejlede — prøv igen' }, { status: 502 });
  }

  const [assistantMsg] = await sql`
    INSERT INTO task_chat_messages (task_id, user_id, role, content)
    VALUES (${id}, ${session.id}, 'assistant', ${replyText})
    RETURNING id, role, content, created_at
  `;
  return NextResponse.json(assistantMsg, { status: 201 });
}
