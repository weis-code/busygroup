import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

// GET — hent portal-medlemmer for en kunde (brugere i tråd + board)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const [cust] = await sql`
    SELECT portal_conversation_id, portal_board_id FROM customers WHERE id = ${params.id}
  ` as unknown as Array<{ portal_conversation_id: string | null; portal_board_id: string | null }>;

  if (!cust) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  if (!cust.portal_conversation_id) return NextResponse.json([]);

  const members = await sql`
    SELECT u.id, u.name, u.email, u.role
    FROM chat_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.conversation_id = ${cust.portal_conversation_id}
    ORDER BY u.name ASC
  `;

  return NextResponse.json(members);
}

// POST — tilføj medlem til tråd + board
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const { user_id } = await req.json();
  if (!user_id) return NextResponse.json({ error: 'user_id mangler' }, { status: 400 });

  const [cust] = await sql`
    SELECT portal_conversation_id, portal_board_id FROM customers WHERE id = ${params.id}
  ` as unknown as Array<{ portal_conversation_id: string | null; portal_board_id: string | null }>;

  if (!cust) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  const now = new Date().toISOString();

  if (cust.portal_conversation_id) {
    await sql`
      INSERT INTO chat_members (id, conversation_id, user_id, joined_at)
      VALUES (${randomUUID()}, ${cust.portal_conversation_id}, ${user_id}, ${now})
      ON CONFLICT (conversation_id, user_id) DO NOTHING
    `;
  }

  if (cust.portal_board_id) {
    await sql`
      INSERT INTO project_board_members (id, board_id, user_id, role)
      VALUES (${randomUUID()}, ${cust.portal_board_id}, ${user_id}, 'member')
      ON CONFLICT (board_id, user_id) DO NOTHING
    `;
  }

  return NextResponse.json({ ok: true });
}

// DELETE — fjern medlem fra tråd + board
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');
  if (!user_id) return NextResponse.json({ error: 'user_id mangler' }, { status: 400 });

  const [cust] = await sql`
    SELECT portal_conversation_id, portal_board_id FROM customers WHERE id = ${params.id}
  ` as unknown as Array<{ portal_conversation_id: string | null; portal_board_id: string | null }>;

  if (!cust) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  if (cust.portal_conversation_id) {
    await sql`
      DELETE FROM chat_members
      WHERE conversation_id = ${cust.portal_conversation_id} AND user_id = ${user_id}
    `;
  }

  if (cust.portal_board_id) {
    await sql`
      DELETE FROM project_board_members
      WHERE board_id = ${cust.portal_board_id} AND user_id = ${user_id}
    `;
  }

  return NextResponse.json({ ok: true });
}
