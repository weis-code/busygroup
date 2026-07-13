import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

function forbidden() { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }
function notFound()  { return NextResponse.json({ error: 'Not found' }, { status: 404 }); }

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') return forbidden();
  const { id } = await params;

  const body = await req.json() as {
    type?: string; direction?: string; title?: string; body?: string;
    outcome?: string; next_action?: string; next_action_date?: string | null; occurred_at?: string;
  };

  const [updated] = await sql`
    UPDATE meridian_lead_activities SET
      type             = COALESCE(${body.type      ?? null}, type),
      direction        = COALESCE(${body.direction ?? null}, direction),
      title            = COALESCE(${body.title     ?? null}, title),
      body             = COALESCE(${body.body      ?? null}, body),
      outcome          = COALESCE(${body.outcome   ?? null}, outcome),
      next_action      = COALESCE(${body.next_action ?? null}, next_action),
      occurred_at      = COALESCE(${body.occurred_at ?? null}, occurred_at)
    WHERE id = ${Number(id)} AND owner_id = ${session.id}
    RETURNING *
  `;
  if (!updated) return notFound();

  if ('next_action_date' in body) {
    await sql`UPDATE meridian_lead_activities SET next_action_date = ${body.next_action_date ?? null} WHERE id = ${Number(id)} AND owner_id = ${session.id}`;
  }
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') return forbidden();
  const { id } = await params;

  const [existing] = await sql`
    SELECT id FROM meridian_lead_activities WHERE id = ${Number(id)} AND owner_id = ${session.id}
  `;
  if (!existing) return notFound();
  await sql`DELETE FROM meridian_lead_activities WHERE id = ${Number(id)} AND owner_id = ${session.id}`;
  return NextResponse.json({ ok: true });
}
