import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { conversationId } = await params;

  try {
    // Verify participation
    const [conv] = await sql`
      SELECT * FROM dm_conversations WHERE id = ${conversationId}
      AND (participant_a = ${session.id} OR participant_b = ${session.id})
    `;
    if (!conv) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50');
    const messages = await sql`
      SELECT m.*, u.name AS sender_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.dm_conversation_id = ${conversationId} AND m.deleted_at IS NULL
      ORDER BY m.created_at DESC
      LIMIT ${limit}
    `;
    return NextResponse.json(messages.reverse());
  } catch (err) {
    console.error('[dm/messages] GET failed:', err);
    return NextResponse.json({ error: 'Database error', detail: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { conversationId } = await params;
  const { body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: 'Besked kræves' }, { status: 400 });

  try {
    // Verify participation
    const [conv] = await sql`
      SELECT * FROM dm_conversations WHERE id = ${conversationId}
      AND (participant_a = ${session.id} OR participant_b = ${session.id})
    `;
    if (!conv) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [msg] = await sql`
      INSERT INTO messages (dm_conversation_id, sender_id, body)
      VALUES (${conversationId}, ${session.id}, ${body.trim()})
      RETURNING *
    `;
    return NextResponse.json({ ...msg, sender_name: session.name }, { status: 201 });
  } catch (err) {
    console.error('[dm/messages] POST failed:', err);
    return NextResponse.json({ error: 'Database error', detail: String(err) }, { status: 500 });
  }
}
