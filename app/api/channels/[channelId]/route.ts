import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { channelId } = await params;
  const [channel] = await sql`SELECT id, created_by FROM channels WHERE id = ${channelId}`;
  if (!channel) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  if (session.role !== 'ADMIN' && channel.created_by !== session.id) {
    return NextResponse.json({ error: 'Kun opretteren eller en admin kan slette kanalen' }, { status: 403 });
  }

  await sql`DELETE FROM messages WHERE channel_id = ${channelId}`;
  await sql`DELETE FROM channel_members WHERE channel_id = ${channelId}`;
  await sql`DELETE FROM channels WHERE id = ${channelId}`;

  return NextResponse.json({ ok: true });
}
