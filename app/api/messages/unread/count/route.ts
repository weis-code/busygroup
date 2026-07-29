import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ count: 0 });

  try {
    const [{ total }] = await sql`
      SELECT (
        SELECT COALESCE(COUNT(m.id), 0)
        FROM channel_members cm
        JOIN messenger_messages m ON m.channel_id = cm.channel_id
        WHERE cm.user_id = ${session.id}
          AND m.deleted_at IS NULL
          AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01'::timestamptz)
          AND m.sender_id != ${session.id}
      ) + (
        SELECT COALESCE(COUNT(m.id), 0)
        FROM messenger_messages m
        JOIN dm_conversations dc ON dc.id = m.dm_conversation_id
        WHERE (dc.participant_a = ${session.id} OR dc.participant_b = ${session.id})
          AND m.sender_id != ${session.id}
          AND m.deleted_at IS NULL
      ) AS total
    `;
    return NextResponse.json({ count: Number(total) });
  } catch (err) {
    console.error('[messages/unread/count] GET failed:', err);
    return NextResponse.json({ count: 0 });
  }
}
