import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

// Hent samtaler for den loggede bruger
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const conversations = await sql`
    SELECT
      cc.id, cc.type, cc.name, cc.created_at,
      -- Seneste besked
      lm.content     AS last_message,
      lm.created_at  AS last_message_at,
      lm.sender_id   AS last_sender_id,
      su.name        AS last_sender_name,
      -- Antal ulæste
      (
        SELECT COUNT(*) FROM chat_messages cm2
        WHERE cm2.conversation_id = cc.id
          AND cm2.created_at > COALESCE(cm.last_read_at, '1970-01-01')
          AND cm2.sender_id != ${session.id}
      ) AS unread_count,
      -- Medlemmer (til direkte beskeder)
      (
        SELECT json_agg(json_build_object('id', u.id, 'name', u.name))
        FROM chat_members cm3
        JOIN users u ON u.id = cm3.user_id
        WHERE cm3.conversation_id = cc.id
          AND cm3.user_id != ${session.id}
      ) AS other_members
    FROM chat_conversations cc
    JOIN chat_members cm ON cm.conversation_id = cc.id AND cm.user_id = ${session.id}
    LEFT JOIN LATERAL (
      SELECT content, created_at, sender_id
      FROM chat_messages
      WHERE conversation_id = cc.id
      ORDER BY created_at DESC LIMIT 1
    ) lm ON true
    LEFT JOIN users su ON su.id = lm.sender_id
    ORDER BY COALESCE(lm.created_at, cc.created_at) DESC
  `;

  return NextResponse.json(conversations);
}

// Opret ny samtale (direkte eller gruppe)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const { type, name, memberIds } = await req.json();
  if (!memberIds?.length) return NextResponse.json({ error: 'Vælg mindst én deltager' }, { status: 400 });

  const allMembers: string[] = Array.from(new Set([session.id, ...memberIds]));

  // For direkte beskeder: tjek om samtale allerede eksisterer
  if (type === 'direct' && allMembers.length === 2) {
    const otherId = allMembers.find(id => id !== session.id)!;
    const [existing] = await sql`
      SELECT cc.id FROM chat_conversations cc
      JOIN chat_members cm1 ON cm1.conversation_id = cc.id AND cm1.user_id = ${session.id}
      JOIN chat_members cm2 ON cm2.conversation_id = cc.id AND cm2.user_id = ${otherId}
      WHERE cc.type = 'direct'
      LIMIT 1
    `;
    if (existing) return NextResponse.json(existing);
  }

  const id  = randomUUID();
  const now = new Date().toISOString();

  await sql`
    INSERT INTO chat_conversations (id, type, name, created_by, created_at)
    VALUES (${id}, ${type || 'direct'}, ${name || null}, ${session.id}, ${now})
  `;

  for (const userId of allMembers) {
    await sql`
      INSERT INTO chat_members (id, conversation_id, user_id, joined_at)
      VALUES (${randomUUID()}, ${id}, ${userId}, ${now})
    `;
  }

  const [conv] = await sql`SELECT * FROM chat_conversations WHERE id = ${id}`;
  return NextResponse.json(conv, { status: 201 });
}
