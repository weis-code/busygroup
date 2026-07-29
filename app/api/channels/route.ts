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
      channel_id  INT REFERENCES channels(id) ON DELETE CASCADE,
      user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
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

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ensureMessengerTables();

  const channels = await sql`
    SELECT ch.*, c.name AS company_name, c.color AS company_color
    FROM channels ch
    JOIN channel_members cm ON cm.channel_id = ch.id
    LEFT JOIN companies c ON c.id = ch.company_id
    WHERE cm.user_id = ${session.id}
    ORDER BY ch.company_id, ch.id
  `;
  return NextResponse.json(channels);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureMessengerTables();

  const { company_id, name, description } = await req.json();

  // Sellers can only create channels in their own company — ignore any
  // client-supplied company_id and resolve it server-side. SELLER accounts
  // rarely have users.company_id set (the seller-creation form never asks
  // for it), so fall back to the NLS company — SELLER is NLS's role.
  let resolvedCompanyId = company_id;
  if (session.role === 'SELLER') {
    const [u] = await sql`SELECT company_id FROM users WHERE id = ${session.id}`;
    if (u?.company_id) {
      resolvedCompanyId = u.company_id;
    } else {
      const [nls] = await sql`SELECT id FROM companies WHERE slug = 'nls'`;
      resolvedCompanyId = nls?.id ?? null;
    }
  }

  if (!resolvedCompanyId || !name) {
    return NextResponse.json({ error: 'company_id og name kræves' }, { status: 400 });
  }

  const [channel] = await sql`
    INSERT INTO channels (company_id, name, description, created_by)
    VALUES (${resolvedCompanyId}, ${name.toLowerCase().replace(/\s+/g, '-')}, ${description ?? null}, ${session.id})
    RETURNING *
  `;
  await sql`INSERT INTO channel_members (channel_id, user_id) VALUES (${channel.id}, ${session.id}) ON CONFLICT DO NOTHING`;
  return NextResponse.json(channel, { status: 201 });
}
