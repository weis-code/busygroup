import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { channelId } = await params;

  try {
    const [channel] = await sql`SELECT id, created_by FROM channels WHERE id = ${channelId}`;
    if (!channel) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

    if (session.role !== 'ADMIN' && channel.created_by !== session.id) {
      const [membership] = await sql`
        SELECT 1 FROM channel_members WHERE channel_id = ${channelId} AND user_id = ${session.id}
      `;
      if (!membership) {
        return NextResponse.json({ error: 'Du er ikke medlem af kanalen' }, { status: 403 });
      }
    }

    await sql`DELETE FROM messenger_messages WHERE channel_id = ${channelId}`;
    await sql`DELETE FROM channel_members WHERE channel_id = ${channelId}`;
    await sql`DELETE FROM channels WHERE id = ${channelId}`;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[channels] delete failed:', err);
    return NextResponse.json({ error: 'Database error', detail: String(err) }, { status: 500 });
  }
}
