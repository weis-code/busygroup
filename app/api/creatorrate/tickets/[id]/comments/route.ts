import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const comments = await sql`
    SELECT * FROM cr_ticket_comments
    WHERE ticket_id = ${id}
    ORDER BY created_at ASC
  `;
  return NextResponse.json(comments);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { body } = await req.json() as { body?: string };
  if (!body?.trim()) return NextResponse.json({ error: 'body kræves' }, { status: 400 });

  const [user] = await sql`SELECT name FROM users WHERE id = ${session.id}`;

  const [comment] = await sql`
    INSERT INTO cr_ticket_comments (ticket_id, user_id, user_name, body)
    VALUES (${id}, ${session.id}, ${user?.name ?? 'Ukendt'}, ${body.trim()})
    RETURNING *
  `;
  return NextResponse.json(comment, { status: 201 });
}
