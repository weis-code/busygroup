import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

// Hent beskeder i en samtale
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const messages = await sql`
    SELECT cm.*, u.name AS sender_name
    FROM chat_messages cm
    JOIN users u ON u.id = cm.sender_id
    WHERE cm.conversation_id = ${params.id}
    ORDER BY cm.created_at ASC
    LIMIT 200
  `;

  // Opdater last_read_at
  await sql`
    UPDATE chat_members SET last_read_at = ${new Date().toISOString()}
    WHERE conversation_id = ${params.id} AND user_id = ${session.id}
  `;

  return NextResponse.json(messages);
}

// Send besked i en samtale
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: 'Tom besked' }, { status: 400 });

  const now = new Date().toISOString();
  const id  = randomUUID();

  await sql`
    INSERT INTO chat_messages (id, conversation_id, sender_id, content, created_at)
    VALUES (${id}, ${params.id}, ${session.id}, ${content.trim()}, ${now})
  `;

  await sql`
    UPDATE chat_members SET last_read_at = ${now}
    WHERE conversation_id = ${params.id} AND user_id = ${session.id}
  `;

  const [msg] = await sql`
    SELECT cm.*, u.name AS sender_name
    FROM chat_messages cm
    JOIN users u ON u.id = cm.sender_id
    WHERE cm.id = ${id}
  `;

  return NextResponse.json(msg, { status: 201 });
}
