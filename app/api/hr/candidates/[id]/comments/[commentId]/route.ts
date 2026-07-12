import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string; commentId: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [comment] = await sql`SELECT * FROM hr_candidate_comments WHERE id = ${params.commentId}`;
  if (!comment) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  if (comment.author_id !== session.id) return NextResponse.json({ error: 'Kan kun redigere egne kommentarer' }, { status: 403 });

  const { body } = await req.json() as { body: string };
  if (!body?.trim()) return NextResponse.json({ error: 'Kommentar kræves' }, { status: 400 });

  const [updated] = await sql`
    UPDATE hr_candidate_comments SET body = ${body.trim()}, updated_at = NOW()
    WHERE id = ${params.commentId}
    RETURNING id, body, updated_at
  `;
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; commentId: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [comment] = await sql`SELECT * FROM hr_candidate_comments WHERE id = ${params.commentId}`;
  if (!comment) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  await sql`DELETE FROM hr_candidate_comments WHERE id = ${params.commentId}`;
  return NextResponse.json({ ok: true });
}
