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

  const [lists, cards, members] = await Promise.all([
    sql`SELECT * FROM board_lists WHERE board_id = ${id} AND is_archived = false ORDER BY position`,
    sql`
      SELECT bc.*, (SELECT COUNT(*) FROM board_card_comments WHERE card_id = bc.id)::int AS comment_count
      FROM board_cards bc WHERE bc.board_id = ${id} AND bc.is_archived = false ORDER BY bc.position
    `,
    sql`
      SELECT bm.user_id, bm.role, bm.joined_at, u.name, u.email, c.name AS company_name
      FROM board_members bm
      JOIN users u ON u.id = bm.user_id
      LEFT JOIN companies c ON c.id = u.company_id
      WHERE bm.board_id = ${id}
      ORDER BY bm.joined_at
    `,
  ]);

  return NextResponse.json({ ...access.board, role: access.role, lists, cards, members });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const access = await getBoardAccess(session, id);
  if (!access || !canManageBoard(access.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const current = access.board as Record<string, unknown>;
  const title       = 'title' in body ? body.title : current.title;
  const description = 'description' in body ? body.description : current.description;
  const visibility   = 'visibility' in body ? body.visibility : current.visibility;
  const companyId    = 'company_id' in body ? body.company_id : current.company_id;
  const color        = 'color' in body ? body.color : current.color;
  const background   = 'background' in body ? body.background : current.background;

  const [updated] = await sql`
    UPDATE boards SET
      title = ${title as string}, description = ${description as string | null},
      visibility = ${visibility as string}, company_id = ${companyId as number | null},
      color = ${color as string}, background = ${background as string | null},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const access = await getBoardAccess(session, id);
  if (!access || access.role !== 'owner') return NextResponse.json({ error: 'Kun ejeren kan slette boardet' }, { status: 403 });

  const hard = req.nextUrl.searchParams.get('hard') === 'true';
  if (hard) {
    await sql`DELETE FROM boards WHERE id = ${id}`;
  } else {
    await sql`UPDATE boards SET is_archived = true, updated_at = NOW() WHERE id = ${id}`;
  }
  return NextResponse.json({ ok: true });
}
