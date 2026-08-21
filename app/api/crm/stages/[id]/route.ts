import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { label, color, probability } = await req.json();

  const [stage] = await sql`
    UPDATE crm_pipeline_stages SET
      label       = COALESCE(${label?.trim() ?? null}, label),
      color       = COALESCE(${(color as string) ?? null}, color),
      probability = COALESCE(${probability != null ? Number(probability) : null}, probability)
    WHERE id = ${Number(id)} AND owner_id = ${session.id} AND workspace_id IS NULL
    RETURNING *
  `;

  if (!stage) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  return NextResponse.json(stage);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { move_deals_to_stage_id?: number };

  // Find the stage to delete
  const [stage] = await sql`
    SELECT * FROM crm_pipeline_stages WHERE id = ${Number(id)} AND owner_id = ${session.id} AND workspace_id IS NULL
  `;
  if (!stage) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  if (stage.is_won || stage.is_lost) {
    return NextResponse.json({ error: 'Kan ikke slette Vundet/Tabt stadie' }, { status: 400 });
  }

  // Move deals from deleted stage to target stage
  if (body.move_deals_to_stage_id) {
    const [target] = await sql`
      SELECT key FROM crm_pipeline_stages
      WHERE id = ${body.move_deals_to_stage_id} AND owner_id = ${session.id} AND workspace_id IS NULL
    `;
    if (target) {
      await sql`
        UPDATE crm_deals SET stage = ${target.key}
        WHERE owner_id = ${session.id} AND workspace_id IS NULL AND stage = ${stage.key as string}
      `;
    }
  }

  await sql`DELETE FROM crm_pipeline_stages WHERE id = ${Number(id)} AND owner_id = ${session.id} AND workspace_id IS NULL`;
  return NextResponse.json({ ok: true });
}
