import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

async function ensureMessengerTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS channels (
      id          SERIAL PRIMARY KEY,
      company_id  INT REFERENCES companies(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      description TEXT,
      is_general  BOOLEAN DEFAULT FALSE,
      created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS channel_members (
      channel_id   INT REFERENCES channels(id) ON DELETE CASCADE,
      user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
      last_read_at TIMESTAMPTZ,
      PRIMARY KEY (channel_id, user_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS dm_conversations (
      id            SERIAL PRIMARY KEY,
      participant_a UUID REFERENCES users(id) ON DELETE CASCADE,
      participant_b UUID REFERENCES users(id) ON DELETE CASCADE,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (participant_a, participant_b)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id                  SERIAL PRIMARY KEY,
      channel_id          INT REFERENCES channels(id) ON DELETE CASCADE,
      dm_conversation_id  INT REFERENCES dm_conversations(id) ON DELETE CASCADE,
      sender_id           UUID REFERENCES users(id) ON DELETE SET NULL,
      body                TEXT NOT NULL,
      deleted_at          TIMESTAMPTZ,
      created_at          TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ensureMessengerTables();

  const convs = await sql`
    SELECT dc.*,
           ua.name AS participant_a_name,
           ub.name AS participant_b_name,
           (SELECT body FROM messages m WHERE m.dm_conversation_id = dc.id AND m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 1) AS last_message,
           (SELECT created_at FROM messages m WHERE m.dm_conversation_id = dc.id AND m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 1) AS last_message_at
    FROM dm_conversations dc
    JOIN users ua ON ua.id = dc.participant_a
    JOIN users ub ON ub.id = dc.participant_b
    WHERE dc.participant_a = ${session.id} OR dc.participant_b = ${session.id}
    ORDER BY last_message_at DESC NULLS LAST
  `;
  return NextResponse.json(convs);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ensureMessengerTables();

  const { other_user_id } = await req.json();
  if (!other_user_id) return NextResponse.json({ error: 'other_user_id kræves' }, { status: 400 });

  // Ensure consistent ordering for unique constraint
  const a = session.id < other_user_id ? session.id : other_user_id;
  const b = session.id < other_user_id ? other_user_id : session.id;

  const [conv] = await sql`
    INSERT INTO dm_conversations (participant_a, participant_b)
    VALUES (${a}, ${b})
    ON CONFLICT (participant_a, participant_b) DO UPDATE SET participant_a = EXCLUDED.participant_a
    RETURNING *
  `;
  return NextResponse.json(conv, { status: 201 });
}
