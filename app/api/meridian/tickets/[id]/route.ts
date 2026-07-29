import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

function forbidden() { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') return forbidden();

  const { id } = await params;
  const [ticket] = await sql`
    SELECT
      t.id, t.source, t.customer_id, t.customer_name, t.title AS subject, t.category AS type,
      t.status, t.priority, t.description, t.resolved_at,
      t.created_at, t.updated_at,
      u.name AS assigned_name
    FROM cr_tickets t
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.id = ${Number(id)} AND t.type = 'support'
  `;
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const messages = await sql`
    SELECT id, ticket_id, user_id AS author_id, user_name AS author_name, is_internal, body, created_at
    FROM cr_ticket_comments
    WHERE ticket_id = ${Number(id)}
    ORDER BY created_at ASC
  `;
  return NextResponse.json({ ...ticket, messages });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') return forbidden();

  const { id } = await params;
  const body = await req.json() as { status?: string; priority?: string; assigned_to?: string | null };

  const [ticket] = await sql`
    UPDATE cr_tickets SET
      status      = COALESCE(${body.status   ?? null}, status),
      priority    = COALESCE(${body.priority ?? null}, priority),
      assignee_id = CASE WHEN ${body.assigned_to !== undefined} THEN ${body.assigned_to ?? null}::uuid ELSE assignee_id END,
      resolved_at = CASE WHEN ${body.status ?? ''} = 'resolved' AND resolved_at IS NULL THEN NOW() ELSE resolved_at END,
      resolved_by = CASE WHEN ${body.status ?? ''} = 'resolved' AND resolved_by IS NULL THEN ${session.id}::uuid ELSE resolved_by END,
      updated_at  = NOW()
    WHERE id = ${Number(id)} AND type = 'support'
    RETURNING
      id, source, customer_id, customer_name, title AS subject, category AS type,
      status, priority, description, resolved_at, created_at, updated_at
  `;
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(ticket);
}
