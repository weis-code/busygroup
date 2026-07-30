import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import { getBoardAccess, canManageBoard } from '@/lib/boards';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const access = await getBoardAccess(session, id);
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const members = await sql`
    SELECT bm.user_id, bm.role, bm.joined_at, u.name, u.email, c.name AS company_name
    FROM board_members bm
    JOIN users u ON u.id = bm.user_id
    LEFT JOIN companies c ON c.id = u.company_id
    WHERE bm.board_id = ${id}
    ORDER BY bm.joined_at
  `;
  return NextResponse.json(members);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const access = await getBoardAccess(session, id);
  if (!access || !canManageBoard(access.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { user_id, email, role } = await req.json();
  let userId = user_id as string | undefined;
  if (!userId && email) {
    const [u] = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (!u) return NextResponse.json({ error: 'Ingen bruger fundet med den email' }, { status: 404 });
    userId = u.id;
  }
  if (!userId) return NextResponse.json({ error: 'user_id eller email kræves' }, { status: 400 });

  const memberRole = ['admin', 'member', 'viewer'].includes(role) ? role : 'member';

  const [member] = await sql`
    INSERT INTO board_members (board_id, user_id, role, invited_by)
    VALUES (${id}, ${userId}, ${memberRole}, ${session.id})
    ON CONFLICT (board_id, user_id) DO UPDATE SET role = EXCLUDED.role
    RETURNING *
  `;
  return NextResponse.json(member, { status: 201 });
}
