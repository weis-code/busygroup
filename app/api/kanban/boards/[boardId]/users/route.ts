import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

// Who can a card on this board be assigned to?
// - ADMIN (the owner) can assign to anyone, in any company.
// - Everyone else sees their own company's colleagues, plus every ADMIN —
//   so a task can always be handed up to the owner regardless of which
//   company a given board happens to belong to.
export async function GET(req: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { boardId } = await params;

  if (session.role === 'ADMIN') {
    const allUsers = await sql`SELECT id, name, email, role FROM users ORDER BY name`;
    return NextResponse.json(allUsers);
  }

  const assignable = await sql`
    SELECT u.id, u.name, u.email, u.role
    FROM users u
    WHERE u.role = 'ADMIN'
       OR u.company_id = (SELECT company_id FROM kanban_boards WHERE id = ${boardId})
    ORDER BY u.name
  `;
  return NextResponse.json(assignable);
}
