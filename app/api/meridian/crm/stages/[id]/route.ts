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
  const body = await req.json() as { name?: string; color?: string; probability?: number };

  const [existing] = await sql`
    SELECT id FROM meridian_pipeline_stages WHERE id = ${id} AND owner_id = ${session.id}
  `;
  if (!existing) return notFound();

  const [updated] = await sql`
    UPDATE meridian_pipeline_stages SET
      name        = COALESCE(${body.name        ?? null}, name),
      color       = COALESCE(${body.color       ?? null}, color),
      probability = COALESCE(${body.probability ?? null}::int, probability)
    WHERE id = ${id} AND owner_id = ${session.id}
    RETURNING *
  `;
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') return forbidden();
  const { id } = await params;

  const [existing] = await sql`
    SELECT id, is_won, is_lost FROM meridian_pipeline_stages WHERE id = ${id} AND owner_id = ${session.id}
  `;
  if (!existing) return notFound();
  if (existing.is_won || existing.is_lost) {
    return NextResponse.json({ error: 'Cannot delete won/lost stages' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({})) as { move_leads_to_stage_id?: number };
  if (body.move_leads_to_stage_id) {
    await sql`
      UPDATE meridian_leads SET stage_id = ${body.move_leads_to_stage_id}
      WHERE stage_id = ${id} AND owner_id = ${session.id}
    `;
  } else {
    await sql`
      UPDATE meridian_leads SET stage_id = NULL
      WHERE stage_id = ${id} AND owner_id = ${session.id}
    `;
  }

  await sql`DELETE FROM meridian_pipeline_stages WHERE id = ${id} AND owner_id = ${session.id}`;
  return NextResponse.json({ ok: true });
}
