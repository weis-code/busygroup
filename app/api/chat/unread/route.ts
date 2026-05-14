import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ unread: 0 });

  const [row] = await sql`
    SELECT COALESCE(SUM(
      (SELECT COUNT(*) FROM chat_messages cm2
       WHERE cm2.conversation_id = cc.id
         AND cm2.created_at > COALESCE(cm.last_read_at, '1970-01-01')
         AND cm2.sender_id != ${session.id})
    ), 0) AS unread
    FROM chat_conversations cc
    JOIN chat_members cm ON cm.conversation_id = cc.id AND cm.user_id = ${session.id}
  ` as unknown as [{ unread: number }];

  return NextResponse.json({ unread: Number(row?.unread ?? 0) });
}
