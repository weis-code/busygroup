import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

function forbidden() { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') return forbidden();

  const { id } = await params;
  const messages = await sql`
    SELECT id, ticket_id, user_id AS author_id, user_name AS author_name, is_internal, body, created_at
    FROM cr_ticket_comments
    WHERE ticket_id = ${Number(id)}
    ORDER BY created_at ASC
  `;
  return NextResponse.json(messages);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') return forbidden();

  const { id } = await params;
  const body = await req.json() as { body: string; is_internal?: boolean };
  if (!body.body?.trim()) return NextResponse.json({ error: 'body required' }, { status: 400 });

  const [ticket] = await sql`SELECT id FROM cr_tickets WHERE id = ${Number(id)} AND type = 'support'`;
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [msg] = await sql`
    INSERT INTO cr_ticket_comments (ticket_id, user_id, user_name, is_internal, body)
    VALUES (${Number(id)}, ${session.id}::uuid, ${session.name ?? 'Team'}, ${body.is_internal ?? false}, ${body.body.trim()})
    RETURNING id, ticket_id, user_id AS author_id, user_name AS author_name, is_internal, body, created_at
  `;
  await sql`UPDATE cr_tickets SET updated_at = NOW() WHERE id = ${Number(id)}`;
  return NextResponse.json(msg, { status: 201 });
}
