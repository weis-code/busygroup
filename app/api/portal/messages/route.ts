import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getPortalSession } from '@/lib/portal-auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

// GET — hent beskeder i portalens tråd
export async function GET() {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const rows = await sql`
    SELECT id, portal_conversation_id FROM customers WHERE id = ${session.id} LIMIT 1
  ` as unknown as Array<{ portal_conversation_id: string | null }>;

  const convId = rows[0]?.portal_conversation_id;
  if (!convId) return NextResponse.json([]);

  const messages = await sql`
    SELECT
      cm.id, cm.conversation_id, cm.sender_id, cm.sender_type, cm.content,
      cm.portal_sender_name, cm.file_name, cm.file_type, cm.file_data, cm.created_at,
      u.name AS sender_name
    FROM chat_messages cm
    LEFT JOIN users u ON u.id = cm.sender_id AND cm.sender_type != 'customer'
    WHERE cm.conversation_id = ${convId}
    ORDER BY cm.created_at ASC
    LIMIT 200
  `;

  return NextResponse.json(messages);
}

// POST — send besked fra portal (customer-side)
export async function POST(req: NextRequest) {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const rows = await sql`
    SELECT portal_conversation_id FROM customers WHERE id = ${session.id} LIMIT 1
  ` as unknown as Array<{ portal_conversation_id: string | null }>;

  const convId = rows[0]?.portal_conversation_id;
  if (!convId) return NextResponse.json({ error: 'Ingen tråd fundet' }, { status: 404 });

  const body = await req.json();
  const { content, file_name, file_type, file_data } = body as {
    content?: string;
    file_name?: string;
    file_type?: string;
    file_data?: string;
  };

  if (!content?.trim() && !file_data) return NextResponse.json({ error: 'Tom besked' }, { status: 400 });

  const now = new Date().toISOString();
  const id = randomUUID();

  // Portal messages use a system user id (null sender_id not allowed due to FK)
  // We use the first internal member of this conversation as sender proxy
  const [firstMember] = await sql`
    SELECT user_id FROM chat_members WHERE conversation_id = ${convId} LIMIT 1
  ` as unknown as Array<{ user_id: string }>;

  if (!firstMember) return NextResponse.json({ error: 'Ingen interne brugere i tråd' }, { status: 500 });

  await sql`
    INSERT INTO chat_messages
      (id, conversation_id, sender_id, sender_type, portal_sender_name, content, file_name, file_type, file_data, created_at)
    VALUES
      (${id}, ${convId}, ${firstMember.user_id}, 'customer', ${session.company},
       ${content?.trim() || ''}, ${file_name || null}, ${file_type || null}, ${file_data || null}, ${now})
  `;

  const [msg] = await sql`SELECT * FROM chat_messages WHERE id = ${id}`;
  return NextResponse.json(msg, { status: 201 });
}
