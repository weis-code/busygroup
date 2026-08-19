import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';
import { VALID_STAGES } from '@/lib/recruitment';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { stage, rejection_reason } = await req.json() as { stage: string; rejection_reason?: string | null };
  if (!VALID_STAGES.includes(stage)) {
    return NextResponse.json({ error: 'Ugyldig stage' }, { status: 400 });
  }

  const [current] = await sql`SELECT stage FROM hr_candidates WHERE id = ${params.id}`;
  if (!current) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  if (current.stage === stage) return NextResponse.json({ id: params.id, stage });

  const [updated] = await sql.begin(async txRaw => {
    const tx = txRaw as unknown as typeof sql;
    const [u] = await tx`
      UPDATE hr_candidates SET
        stage = ${stage},
        updated_at = NOW(),
        hired_at = CASE WHEN ${stage} = 'ansat' AND hired_at IS NULL THEN NOW() ELSE hired_at END,
        stopped_at = CASE WHEN ${stage} = 'stoppet' THEN NOW() ELSE stopped_at END,
        rejection_reason = ${stage === 'stoppet' ? (rejection_reason ?? null) : sql`rejection_reason`}
      WHERE id = ${params.id}
      RETURNING id, stage, hired_at, stopped_at, rejection_reason, updated_at
    `;
    await tx`
      INSERT INTO recruitment_stage_history (candidate_id, from_stage, to_stage, changed_by)
      VALUES (${params.id}, ${current.stage}, ${stage}, ${session.id})
    `;
    return [u];
  });

  return NextResponse.json(updated);
}
