import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as { is_completed?: boolean; title?: string; due_date?: string | null };

  const [updated] = await sql`
    UPDATE recruitment_candidate_checklist SET
      title        = COALESCE(${body.title ?? null}, title),
      due_date     = ${body.due_date !== undefined ? (body.due_date ?? null) : sql`due_date`},
      is_completed = ${body.is_completed !== undefined ? body.is_completed : sql`is_completed`},
      completed_at = CASE
        WHEN ${body.is_completed !== undefined ? body.is_completed : null} IS NULL THEN completed_at
        WHEN ${body.is_completed ?? false} THEN NOW()
        ELSE NULL
      END,
      completed_by = CASE
        WHEN ${body.is_completed !== undefined ? body.is_completed : null} IS NULL THEN completed_by
        WHEN ${body.is_completed ?? false} THEN ${session.id}
        ELSE NULL
      END
    WHERE id = ${params.itemId} AND candidate_id = ${params.id}
    RETURNING id, candidate_id, template_item_id, title, is_completed, completed_at, completed_by, due_date::text, position
  `;
  if (!updated) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await sql`DELETE FROM recruitment_candidate_checklist WHERE id = ${params.itemId} AND candidate_id = ${params.id}`;
  return NextResponse.json({ ok: true });
}
