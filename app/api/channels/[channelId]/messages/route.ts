import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { channelId } = await params;
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50');
  const before = req.nextUrl.searchParams.get('before');

  try {
    const messages = before
      ? await sql`
          SELECT m.*, u.name AS sender_name
          FROM messenger_messages m
          JOIN users u ON u.id = m.sender_id
          WHERE m.channel_id = ${channelId} AND m.deleted_at IS NULL AND m.id < ${before}
          ORDER BY m.created_at DESC
          LIMIT ${limit}
        `
      : await sql`
          SELECT m.*, u.name AS sender_name
          FROM messenger_messages m
          JOIN users u ON u.id = m.sender_id
          WHERE m.channel_id = ${channelId} AND m.deleted_at IS NULL
          ORDER BY m.created_at DESC
          LIMIT ${limit}
        `;

    // Update last_read
    await sql`
      UPDATE channel_members SET last_read_at = NOW()
      WHERE channel_id = ${channelId} AND user_id = ${session.id}
    `;

    return NextResponse.json(messages.reverse());
  } catch (err) {
    console.error('[channels/messages] GET failed:', err);
    return NextResponse.json({ error: 'Database error', detail: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { channelId } = await params;
  const { body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: 'Besked kræves' }, { status: 400 });

  try {
    const [channel] = await sql`SELECT id FROM channels WHERE id = ${channelId}`;
    if (!channel) return NextResponse.json({ error: 'Kanalen findes ikke længere' }, { status: 404 });

    const [msg] = await sql`
      INSERT INTO messenger_messages (channel_id, sender_id, body)
      VALUES (${channelId}, ${session.id}, ${body.trim()})
      RETURNING *
    `;
    return NextResponse.json({ ...msg, sender_name: session.name }, { status: 201 });
  } catch (err) {
    console.error('[channels/messages] POST failed:', err);
    return NextResponse.json({ error: 'Database error', detail: String(err) }, { status: 500 });
  }
}
