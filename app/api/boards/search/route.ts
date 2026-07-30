import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q) return NextResponse.json({ boards: [], cards: [] });

  const [me] = await sql`SELECT company_id FROM users WHERE id = ${session.id}`;
  const myCompanyId = me?.company_id ?? null;

  const accessible = sql`
    SELECT b.id FROM boards b
    LEFT JOIN board_members bm ON bm.board_id = b.id AND bm.user_id = ${session.id}
    WHERE b.is_archived = false
      AND (
        ${session.role === 'ADMIN'}
        OR b.owner_id = ${session.id}
        OR bm.id IS NOT NULL
        OR b.visibility = 'workspace'
        OR (b.visibility = 'company' AND b.company_id = ${myCompanyId})
      )
  `;

  const [boards, cards] = await Promise.all([
    sql`
      SELECT b.id, b.title, b.color, b.visibility FROM boards b
      WHERE b.id IN (${accessible}) AND b.title ILIKE ${'%' + q + '%'}
      LIMIT 20
    `,
    sql`
      SELECT c.id, c.title, c.board_id, b.title AS board_title
      FROM board_cards c JOIN boards b ON b.id = c.board_id
      WHERE c.board_id IN (${accessible}) AND c.is_archived = false AND c.title ILIKE ${'%' + q + '%'}
      LIMIT 30
    `,
  ]);

  return NextResponse.json({ boards, cards });
}
