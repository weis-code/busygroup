import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

function forbidden() { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

// Kundeservice — koncern-wide by default (every company's customer support
// tickets together, e.g. Meridian + CreatorRate), filterable down to one via
// `source`. Deliberately excludes type='dev' (Group's internal dev backlog —
// a different concept, not customer-facing, kept on its own page).
export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') return forbidden();

  const { searchParams } = new URL(req.url);
  const source      = searchParams.get('source'); // omitted = all support sources together
  const status      = searchParams.get('status');
  const priority    = searchParams.get('priority');
  const assignedTo  = searchParams.get('assigned_to');
  const customerId  = searchParams.get('customer_id');
  const search      = searchParams.get('search');

  const tickets = await sql`
    SELECT
      t.id, t.source, t.customer_id, t.customer_name, t.title AS subject, t.category AS type,
      t.status, t.priority, t.description, t.resolved_at,
      t.created_at, t.updated_at,
      u.name AS assigned_name,
      COUNT(m.id)::int AS message_count,
      (SELECT m2.body FROM cr_ticket_comments m2 WHERE m2.ticket_id = t.id ORDER BY m2.created_at DESC LIMIT 1) AS latest_message
    FROM cr_tickets t
    LEFT JOIN users u ON u.id = t.assignee_id
    LEFT JOIN cr_ticket_comments m ON m.ticket_id = t.id
    WHERE t.type = 'support'
      ${source     ? sql`AND t.source = ${source}`                           : sql``}
      ${status     ? sql`AND t.status = ${status}`                          : sql``}
      ${priority   ? sql`AND t.priority = ${priority}`                      : sql``}
      ${assignedTo ? sql`AND t.assignee_id = ${assignedTo}::uuid`           : sql``}
      ${customerId ? sql`AND t.customer_id = ${Number(customerId)}`         : sql``}
      ${search     ? sql`AND (t.title ILIKE ${'%' + search + '%'} OR t.customer_name ILIKE ${'%' + search + '%'})` : sql``}
    GROUP BY t.id, u.name
    ORDER BY
      CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
      t.created_at DESC
  `;
  return NextResponse.json(tickets);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') return forbidden();

  const body = await req.json() as {
    source?: string; customer_id?: number; customer_name?: string; subject: string;
    description?: string; type?: string; priority?: string; assigned_to?: string;
  };
  if (!body.subject?.trim()) return NextResponse.json({ error: 'subject required' }, { status: 400 });

  let customerName = body.customer_name ?? '';
  if (!customerName && body.customer_id) {
    const [c] = await sql`SELECT name FROM customers WHERE id = ${body.customer_id}`;
    customerName = c?.name ?? '';
  }

  const [ticket] = await sql`
    INSERT INTO cr_tickets
      (source, type, customer_id, customer_name, title, description, category, priority, assignee_id, created_by)
    VALUES
      (${body.source ?? 'meridian'}, 'support', ${body.customer_id ?? null}, ${customerName}, ${body.subject.trim()},
       ${body.description ?? null}, ${body.type ?? 'general'}, ${body.priority ?? 'normal'},
       ${body.assigned_to ?? null}, ${session.id})
    RETURNING
      id, source, customer_id, customer_name, title AS subject, category AS type,
      status, priority, description, resolved_at, created_at, updated_at
  `;
  return NextResponse.json(ticket, { status: 201 });
}
