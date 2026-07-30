import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const archived = req.nextUrl.searchParams.get('archived') === 'true';

  const [me] = await sql`SELECT company_id FROM users WHERE id = ${session.id}`;
  const myCompanyId = me?.company_id ?? null;

  const rows = await sql`
    SELECT
      b.*,
      u.name AS owner_name,
      bm.role AS member_role,
      (bm.id IS NOT NULL) AS is_explicit_member,
      (SELECT COUNT(*) FROM board_members WHERE board_id = b.id) AS member_count,
      (SELECT COUNT(*) FROM board_cards WHERE board_id = b.id AND is_archived = false) AS card_count
    FROM boards b
    JOIN users u ON u.id = b.owner_id
    LEFT JOIN board_members bm ON bm.board_id = b.id AND bm.user_id = ${session.id}
    WHERE b.is_archived = ${archived}
      AND (
        ${session.role === 'ADMIN'}
        OR b.owner_id = ${session.id}
        OR bm.id IS NOT NULL
        OR b.visibility = 'workspace'
        OR (b.visibility = 'company' AND b.company_id = ${myCompanyId})
      )
    ORDER BY b.updated_at DESC
  `;

  const boards = rows.map(b => ({
    ...b,
    is_owner: b.owner_id === session.id,
    role: b.owner_id === session.id ? 'owner' : (b.member_role ?? (session.role === 'ADMIN' ? 'admin' : 'member')),
    member_count: Number(b.member_count),
    card_count: Number(b.card_count),
  }));

  return NextResponse.json(boards);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, description, visibility, company_id, color } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: 'Titel kræves' }, { status: 400 });

  const vis = ['private', 'company', 'workspace'].includes(visibility) ? visibility : 'private';
  const companyId = vis === 'company' ? (company_id ?? null) : null;

  const [board] = await sql`
    INSERT INTO boards (title, description, owner_id, visibility, company_id, color)
    VALUES (${title.trim()}, ${description || null}, ${session.id}, ${vis}, ${companyId}, ${color || '#4f8ef7'})
    RETURNING *
  `;

  await sql`
    INSERT INTO board_members (board_id, user_id, role, invited_by)
    VALUES (${board.id}, ${session.id}, 'admin', ${session.id})
  `;

  // Seed a starter set of lists so a new board isn't empty
  const starterLists = ['At gøre', 'I gang', 'Færdig'];
  for (let i = 0; i < starterLists.length; i++) {
    await sql`INSERT INTO board_lists (board_id, title, position) VALUES (${board.id}, ${starterLists[i]}, ${i})`;
  }

  return NextResponse.json(board, { status: 201 });
}
