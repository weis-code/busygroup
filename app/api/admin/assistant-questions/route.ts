import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const status = req.nextUrl.searchParams.get('status'); // pending | answered | (omit = all)

  const rows = await sql`
    SELECT q.id, q.task_id, q.question, q.answer, q.status, q.created_at, q.answered_at,
           t.name AS task_name, t.client AS task_client,
           u.name AS seller_name,
           a.name AS answered_by_name
    FROM task_assistant_questions q
    JOIN tasks t ON t.id = q.task_id
    JOIN users u ON u.id = q.seller_id
    LEFT JOIN users a ON a.id = q.answered_by
    WHERE 1=1
      ${status ? sql`AND q.status = ${status}` : sql``}
    ORDER BY q.created_at DESC
  `;
  return NextResponse.json(rows);
}
