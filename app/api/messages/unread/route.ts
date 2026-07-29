import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const channelUnread = await sql`
      SELECT cm.channel_id,
             COUNT(m.id) AS unread_count
      FROM channel_members cm
      JOIN messenger_messages m ON m.channel_id = cm.channel_id
      WHERE cm.user_id = ${session.id}
        AND m.deleted_at IS NULL
        AND m.created_at > cm.last_read_at
        AND m.sender_id != ${session.id}
      GROUP BY cm.channel_id
    `;

    const dmUnread = await sql`
      SELECT m.dm_conversation_id AS conversation_id,
             COUNT(m.id) AS unread_count
      FROM messenger_messages m
      JOIN dm_conversations dc ON dc.id = m.dm_conversation_id
      WHERE (dc.participant_a = ${session.id} OR dc.participant_b = ${session.id})
        AND m.sender_id != ${session.id}
        AND m.deleted_at IS NULL
      GROUP BY m.dm_conversation_id
    `;

    return NextResponse.json({ channels: channelUnread, dms: dmUnread });
  } catch (err) {
    console.error('[messages/unread] GET failed:', err);
    return NextResponse.json({ channels: [], dms: [] });
  }
}
