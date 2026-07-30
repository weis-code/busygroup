import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import { uploadObject } from '@/lib/storage';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;

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

  const contentType = req.headers.get('content-type') ?? '';
  let body = '';
  let file: File | null = null;

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    body = String(form.get('body') ?? '');
    const f = form.get('file');
    if (f instanceof File && f.size > 0) file = f;
  } else {
    const json = await req.json();
    body = String(json.body ?? '');
  }

  if (!body.trim() && !file) return NextResponse.json({ error: 'Besked eller fil kræves' }, { status: 400 });
  if (file && file.size > MAX_ATTACHMENT_SIZE) {
    return NextResponse.json({ error: 'Filen må maks være 20 MB' }, { status: 400 });
  }

  try {
    const [channel] = await sql`SELECT id FROM channels WHERE id = ${channelId}`;
    if (!channel) return NextResponse.json({ error: 'Kanalen findes ikke længere' }, { status: 404 });

    let attachmentKey: string | null = null;
    let attachmentName: string | null = null;
    let attachmentType: string | null = null;
    let attachmentSize: number | null = null;

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      attachmentType = file.type || 'application/octet-stream';
      attachmentKey = `messenger/channel-${channelId}/${randomUUID()}-${file.name}`;
      attachmentName = file.name;
      attachmentSize = file.size;
      try {
        await uploadObject(attachmentKey, buffer, attachmentType);
      } catch (err) {
        console.error('[channels/messages] attachment upload failed:', err);
        return NextResponse.json({ error: 'Upload til storage fejlede — tjek storage-konfiguration' }, { status: 500 });
      }
    }

    const [msg] = await sql`
      INSERT INTO messenger_messages (channel_id, sender_id, body, attachment_key, attachment_name, attachment_type, attachment_size)
      VALUES (${channelId}, ${session.id}, ${body.trim()}, ${attachmentKey}, ${attachmentName}, ${attachmentType}, ${attachmentSize})
      RETURNING *
    `;
    return NextResponse.json({ ...msg, sender_name: session.name }, { status: 201 });
  } catch (err) {
    console.error('[channels/messages] POST failed:', err);
    return NextResponse.json({ error: 'Database error', detail: String(err) }, { status: 500 });
  }
}
