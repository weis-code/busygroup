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
    SELECT t.*, u.name AS assigned_name
    FROM meridian_tickets t
    LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.id = ${Number(id)}
  `;
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const messages = await sql`
    SELECT * FROM meridian_ticket_messages
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
    UPDATE meridian_tickets SET
      status      = COALESCE(${body.status      ?? null}, status),
      priority    = COALESCE(${body.priority    ?? null}, priority),
      assigned_to = CASE WHEN ${body.assigned_to !== undefined} THEN ${body.assigned_to ?? null}::uuid ELSE assigned_to END,
      resolved_at = CASE WHEN ${body.status ?? ''} = 'resolved' AND resolved_at IS NULL THEN NOW() ELSE resolved_at END,
      resolved_by = CASE WHEN ${body.status ?? ''} = 'resolved' AND resolved_by IS NULL THEN ${session.id}::uuid ELSE resolved_by END,
      updated_at  = NOW()
    WHERE id = ${Number(id)}
    RETURNING *
  `;
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(ticket);
}
