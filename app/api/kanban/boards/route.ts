import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (session.role === 'SELLER') {
    // Return personal board + company general board
    const boards = await sql`
      SELECT kb.*, c.name AS company_name, c.color AS company_color
      FROM kanban_boards kb
      LEFT JOIN companies c ON c.id = kb.company_id
      WHERE kb.owner_user_id = ${session.id}
         OR (kb.owner_user_id IS NULL AND kb.company_id = (
           SELECT company_id FROM kanban_boards WHERE owner_user_id IS NULL LIMIT 1
         ))
      ORDER BY kb.id
    `;
    return NextResponse.json(boards);
  }

  // Admin: all boards
  const boards = await sql`
    SELECT kb.*, c.name AS company_name, c.color AS company_color
    FROM kanban_boards kb
    LEFT JOIN companies c ON c.id = kb.company_id
    ORDER BY kb.id
  `;
  return NextResponse.json(boards);
}
