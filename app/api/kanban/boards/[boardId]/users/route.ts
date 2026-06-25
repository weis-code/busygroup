import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

const SPECIAL_EMAILS = ['weis@busygroup.dk', 'casper@busygroup.dk'];

export async function GET(req: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { boardId } = await params;

  const companyUsers = await sql`
    SELECT u.id, u.name, u.email, u.role
    FROM users u
    JOIN kanban_boards kb ON kb.company_id = u.company_id
    WHERE kb.id = ${boardId}
    ORDER BY u.name
  `;

  const seenEmails = companyUsers.map((u: Record<string, unknown>) => u.email as string);

  const extra = await sql`
    SELECT id, name, email, role FROM users
    WHERE email = ANY(${SPECIAL_EMAILS})
    AND email != ALL(${seenEmails})
  `;

  return NextResponse.json([...companyUsers, ...extra]);
}
