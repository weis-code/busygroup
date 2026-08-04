import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const {
    title, type, direction, body: noteBody, outcome, duration_minutes,
    next_action, next_action_date, next_action_done, extra,
  } = body;
  // Personal CRM: everyone below ADMIN may only edit their own touchpoints.
  const ownerFilter = session.role === 'ADMIN' ? sql`` : sql`AND owner_id = ${session.id}`;

  const [row] = await sql`
    UPDATE crm_touchpoints SET
      title            = COALESCE(${title?.trim() ?? null}, title),
      type             = COALESCE(${(type as string) ?? null}, type),
      direction        = COALESCE(${(direction as string) ?? null}, direction),
      body             = COALESCE(${noteBody?.trim() ?? null}, body),
      outcome          = COALESCE(${(outcome as string) ?? null}, outcome),
      duration_minutes = COALESCE(${duration_minutes != null ? Number(duration_minutes) : null}, duration_minutes),
      next_action      = CASE WHEN ${next_action !== undefined} THEN ${next_action?.trim() ?? null} ELSE next_action END,
      next_action_date = CASE WHEN ${next_action_date !== undefined} THEN ${next_action_date ?? null} ELSE next_action_date END,
      next_action_done = CASE WHEN ${next_action_done !== undefined} THEN ${next_action_done === true} ELSE next_action_done END,
      extra            = COALESCE(${extra != null ? JSON.stringify(extra) : null}::jsonb, extra)
    WHERE id = ${Number(id)} ${ownerFilter}
    RETURNING *
  `;

  if (!row) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const ownerFilter = session.role === 'ADMIN' ? sql`` : sql`AND owner_id = ${session.id}`;
  const [row] = await sql`DELETE FROM crm_touchpoints WHERE id = ${Number(id)} ${ownerFilter} RETURNING id`;
  if (!row) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
