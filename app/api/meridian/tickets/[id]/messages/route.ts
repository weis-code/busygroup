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
    SELECT * FROM meridian_ticket_messages
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

  const [ticket] = await sql`SELECT id FROM meridian_tickets WHERE id = ${Number(id)}`;
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [msg] = await sql`
    INSERT INTO meridian_ticket_messages (ticket_id, author_id, author_name, is_internal, body)
    VALUES (${Number(id)}, ${session.id}::uuid, ${session.name ?? 'Team'}, ${body.is_internal ?? false}, ${body.body.trim()})
    RETURNING *
  `;
  await sql`UPDATE meridian_tickets SET updated_at = NOW() WHERE id = ${Number(id)}`;
  return NextResponse.json(msg, { status: 201 });
}
