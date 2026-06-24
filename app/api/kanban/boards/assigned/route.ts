import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cards = await sql`
    SELECT kc.*,
           u.name  AS assigned_name,
           u2.name AS creator_name,
           kb.name AS board_name,
           c.name  AS company_name,
           c.color AS company_color,
           c.logo_initials AS company_initials
    FROM kanban_cards kc
    LEFT JOIN users u  ON u.id  = kc.assigned_to
    LEFT JOIN users u2 ON u2.id = kc.created_by
    JOIN  kanban_boards kb ON kb.id = kc.board_id
    LEFT JOIN companies c  ON c.id  = kb.company_id
    WHERE kc.assigned_to = ${session.id}
      AND kc.completed_at IS NULL
    ORDER BY kc.created_at DESC
  `;
  return NextResponse.json(cards);
}
