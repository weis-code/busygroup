import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import { getObject } from '@/lib/storage';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ messageId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { messageId } = await params;

  const [msg] = await sql`
    SELECT m.attachment_key, m.attachment_name, m.attachment_type, m.channel_id, m.dm_conversation_id
    FROM messenger_messages m
    WHERE m.id = ${messageId} AND m.deleted_at IS NULL AND m.attachment_key IS NOT NULL
  `;
  if (!msg) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  if (msg.channel_id) {
    const [member] = await sql`
      SELECT 1 FROM channel_members WHERE channel_id = ${msg.channel_id} AND user_id = ${session.id}
    `;
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } else if (msg.dm_conversation_id) {
    const [conv] = await sql`
      SELECT 1 FROM dm_conversations
      WHERE id = ${msg.dm_conversation_id} AND (participant_a = ${session.id} OR participant_b = ${session.id})
    `;
    if (!conv) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { body, contentType } = await getObject(msg.attachment_key);
    const download = req.nextUrl.searchParams.get('download') === '1';
    const disposition = download
      ? `attachment; filename="${encodeURIComponent(msg.attachment_name ?? 'fil')}"`
      : `inline; filename="${encodeURIComponent(msg.attachment_name ?? 'fil')}"`;
    return new NextResponse(new Uint8Array(body), {
      headers: {
        'Content-Type': contentType ?? msg.attachment_type ?? 'application/octet-stream',
        'Content-Disposition': disposition,
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('[messenger/attachments] fetch failed:', err);
    return NextResponse.json({ error: 'Kunne ikke hente fil' }, { status: 500 });
  }
}
