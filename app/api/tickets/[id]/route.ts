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
  const [ticket] = await sql`
    SELECT
      t.*,
      a.name AS assignee_name,
      c.name AS created_by_name
    FROM cr_tickets t
    LEFT JOIN users a ON a.id = t.assignee_id
    LEFT JOIN users c ON c.id = t.created_by
    WHERE t.id = ${id}
  `;

  if (!ticket) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  return NextResponse.json(ticket);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as {
    status?: string;
    priority?: string;
    title?: string;
    description?: string;
    assignee_id?: string | null;
    reporter_name?: string;
    reporter_email?: string;
  };

  const [ticket] = await sql`
    UPDATE cr_tickets SET
      status        = COALESCE(${body.status ?? null}, status),
      priority      = COALESCE(${body.priority ?? null}, priority),
      title         = COALESCE(${body.title ?? null}, title),
      description   = COALESCE(${body.description ?? null}, description),
      assignee_id   = CASE WHEN ${body.assignee_id !== undefined} THEN ${body.assignee_id ?? null}::uuid ELSE assignee_id END,
      reporter_name  = COALESCE(${body.reporter_name ?? null}, reporter_name),
      reporter_email = COALESCE(${body.reporter_email ?? null}, reporter_email),
      updated_at    = NOW()
    WHERE id = ${id}
    RETURNING id, status, priority, updated_at
  `;

  if (!ticket) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  return NextResponse.json(ticket);
}
