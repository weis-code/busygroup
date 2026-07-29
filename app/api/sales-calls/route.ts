import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { sessionFromRequest } from '@/lib/auth';
import { uploadObject } from '@/lib/storage';
import { transcribeAudio } from '@/lib/transcription';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

const MODEL = 'claude-opus-5';

const FEEDBACK_SYSTEM = `Du er en erfaren salgscoach hos NextLevel Sales. Du får en transskription af et salgsopkald og skal give konstruktiv, konkret feedback til sælgeren på dansk.

Vurder:
- Åbning og relationsopbygning
- Behovsafdækning (stillede sælgeren gode spørgsmål?)
- Håndtering af indvendinger
- Tydelighed omkring produkt/pris
- Næste skridt / afslutning

Giv feedbacken som en kort, struktureret liste: 2-3 styrker, 2-3 forbedringspunkter, og ét konkret råd til næste opkald. Vær direkte og handlingsorienteret — ikke vagt eller overdrevent positivt.`;

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const calls = await sql`
    SELECT id, task_id, filename, status, duration_seconds, transcript, feedback, error, created_at
    FROM sales_calls
    WHERE seller_id = ${session.id}
    ORDER BY created_at DESC
  `;
  return NextResponse.json(calls);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  const taskId = form.get('task_id');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Lydfil kræves' }, { status: 400 });
  }
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'Filen må maks være 50 MB' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || 'application/octet-stream';
  const storageKey = `sales-calls/${session.id}/${randomUUID()}-${file.name}`;

  try {
    await uploadObject(storageKey, buffer, contentType);
  } catch (err) {
    console.error('[sales-calls] upload failed:', err);
    return NextResponse.json({ error: 'Upload til storage fejlede — tjek storage-konfiguration' }, { status: 500 });
  }

  const [call] = await sql`
    INSERT INTO sales_calls (task_id, seller_id, filename, storage_key, status)
    VALUES (${taskId ? String(taskId) : null}, ${session.id}, ${file.name}, ${storageKey}, 'processing')
    RETURNING id, task_id, filename, status, created_at
  `;

  try {
    const transcript = await transcribeAudio(buffer, file.name, contentType);

    let feedback = '';
    if (process.env.ANTHROPIC_API_KEY) {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: FEEDBACK_SYSTEM,
        messages: [{ role: 'user', content: `Transskription af salgsopkald:\n\n${transcript}` }],
      });
      const textBlock = response.content.find(b => b.type === 'text');
      feedback = textBlock && textBlock.type === 'text' ? textBlock.text : '';
    } else {
      feedback = 'Feedback kunne ikke genereres — ANTHROPIC_API_KEY mangler.';
    }

    await sql`
      UPDATE sales_calls SET status = 'done', transcript = ${transcript}, feedback = ${feedback}
      WHERE id = ${call.id}
    `;
  } catch (err) {
    console.error('[sales-calls] processing failed:', err);
    await sql`UPDATE sales_calls SET status = 'failed', error = ${String(err)} WHERE id = ${call.id}`;
  }

  const [finalCall] = await sql`
    SELECT id, task_id, filename, status, duration_seconds, transcript, feedback, error, created_at
    FROM sales_calls WHERE id = ${call.id}
  `;
  return NextResponse.json(finalCall, { status: 201 });
}
