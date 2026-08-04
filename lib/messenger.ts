import sql from '@/lib/db';

export async function ensureMessengerTables() {
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
    CREATE TABLE IF NOT EXISTS messenger_messages (
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

export async function getOrCreateDmConversation(userIdA: string, userIdB: string): Promise<number> {
  const a = userIdA < userIdB ? userIdA : userIdB;
  const b = userIdA < userIdB ? userIdB : userIdA;
  const [conv] = await sql`
    INSERT INTO dm_conversations (participant_a, participant_b)
    VALUES (${a}, ${b})
    ON CONFLICT (participant_a, participant_b) DO UPDATE SET participant_a = EXCLUDED.participant_a
    RETURNING id
  `;
  return conv.id;
}
