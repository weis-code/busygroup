import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

const VALID_STAGES = ['applied', 'no_response', 'interview_booked', 'follow_up', 'hired', 'stopped'];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { stage } = await req.json() as { stage: string };
  if (!VALID_STAGES.includes(stage)) {
    return NextResponse.json({ error: 'Ugyldig stage' }, { status: 400 });
  }

  const [updated] = await sql`
    UPDATE hr_candidates SET stage = ${stage}, updated_at = NOW()
    WHERE id = ${params.id}
    RETURNING id, stage, updated_at
  `;
  if (!updated) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  return NextResponse.json(updated);
}
