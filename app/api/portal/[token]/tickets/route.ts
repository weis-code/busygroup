import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

async function resolveAccess(token: string) {
  const [access] = await sql`
    SELECT pa.customer_id, cu.name AS customer_name
    FROM portal_access pa
    JOIN customers cu ON cu.id = pa.customer_id
    WHERE pa.portal_token = ${token}
  `;
  return access as { customer_id: number; customer_name: string } | undefined;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await resolveAccess(token);
  if (!access) return NextResponse.json({ error: 'Ugyldig token' }, { status: 404 });

  const tickets = await sql`
    SELECT t.id, t.subject, t.status, t.priority, t.type, t.created_at,
      (SELECT COUNT(*)::int FROM meridian_ticket_messages m WHERE m.ticket_id = t.id AND m.is_internal = false) AS message_count
    FROM meridian_tickets t
    WHERE t.customer_id = ${access.customer_id}
    ORDER BY t.created_at DESC
  `;
  return NextResponse.json(tickets);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await resolveAccess(token);
  if (!access) return NextResponse.json({ error: 'Ugyldig token' }, { status: 404 });

  const body = await req.json() as { subject: string; description?: string; type?: string };
  if (!body.subject?.trim()) return NextResponse.json({ error: 'subject required' }, { status: 400 });

  const [ticket] = await sql`
    INSERT INTO meridian_tickets (customer_id, customer_name, subject, description, type)
    VALUES (${access.customer_id}, ${access.customer_name}, ${body.subject.trim()}, ${body.description ?? null}, ${body.type ?? 'general'})
    RETURNING *
  `;

  // First message from customer
  if (body.description?.trim()) {
    await sql`
      INSERT INTO meridian_ticket_messages (ticket_id, author_name, is_internal, body)
      VALUES (${ticket.id}, ${access.customer_name}, false, ${body.description.trim()})
    `;
  }

  return NextResponse.json(ticket, { status: 201 });
}
