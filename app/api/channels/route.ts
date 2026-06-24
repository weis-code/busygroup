import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Return channels the user is a member of
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
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { company_id, name, description } = await req.json();
  if (!company_id || !name) {
    return NextResponse.json({ error: 'company_id og name kræves' }, { status: 400 });
  }

  const [channel] = await sql`
    INSERT INTO channels (company_id, name, description, created_by)
    VALUES (${company_id}, ${name.toLowerCase().replace(/\s+/g, '-')}, ${description ?? null}, ${session.id})
    RETURNING *
  `;
  // Add creator as member
  await sql`INSERT INTO channel_members (channel_id, user_id) VALUES (${channel.id}, ${session.id}) ON CONFLICT DO NOTHING`;
  return NextResponse.json(channel, { status: 201 });
}
