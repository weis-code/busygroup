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

  const [handover] = await sql`
    UPDATE handovers SET
      what_was_sold = COALESCE(${body.what_was_sold ?? null}, what_was_sold),
      mrr_dkk       = COALESCE(${body.mrr_dkk ?? null}, mrr_dkk),
      customer_goal = COALESCE(${body.customer_goal ?? null}, customer_goal),
      promises      = COALESCE(${body.promises ?? null}, promises),
      am_user_id    = COALESCE(${body.am_user_id ?? null}, am_user_id),
      kam_user_id   = COALESCE(${body.kam_user_id ?? null}, kam_user_id),
      deadline      = COALESCE(${body.deadline ?? null}, deadline),
      status        = COALESCE(${body.status ?? null}, status),
      updated_at    = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return NextResponse.json(handover);
}
