import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  const members = await sql`
    SELECT u.id, u.name, u.role, cm.last_read_at
    FROM channel_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.channel_id = ${channelId}
    ORDER BY u.name
  `;
  return NextResponse.json(members);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { channelId } = await params;
  const { user_id } = await req.json();
  if (!user_id) return NextResponse.json({ error: 'user_id kræves' }, { status: 400 });

  await sql`
    INSERT INTO channel_members (channel_id, user_id)
    VALUES (${channelId}, ${user_id})
    ON CONFLICT DO NOTHING
  `;
  return NextResponse.json({ ok: true }, { status: 201 });
}
