import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const { stage_id, lost_reason } = await req.json() as { stage_id: number; lost_reason?: string };

  const [existing] = await sql`
    SELECT id FROM meridian_leads WHERE id = ${Number(id)} AND owner_id = ${session.id}
  `;
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [stage] = await sql`
    SELECT * FROM meridian_pipeline_stages WHERE id = ${stage_id} AND owner_id = ${session.id}
  `;
  if (!stage) return NextResponse.json({ error: 'Stage not found' }, { status: 404 });

  const now = new Date().toISOString();
  const [lead] = await sql`
    UPDATE meridian_leads SET
      stage_id    = ${stage_id},
      probability = ${stage.probability},
      won_at      = CASE WHEN ${stage.is_won}::boolean  THEN ${now}::timestamptz ELSE NULL END,
      lost_at     = CASE WHEN ${stage.is_lost}::boolean THEN ${now}::timestamptz ELSE NULL END,
      lost_reason = CASE WHEN ${stage.is_lost}::boolean AND ${lost_reason ?? null} IS NOT NULL
                         THEN ${lost_reason ?? null} ELSE lost_reason END,
      updated_at  = NOW()
    WHERE id = ${Number(id)} AND owner_id = ${session.id}
    RETURNING *
  `;
  return NextResponse.json(lead);
}
