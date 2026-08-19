import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as { title?: string; description?: string | null; days_before_start?: number; position?: number };

  const [updated] = await sql`
    UPDATE recruitment_checklist_items SET
      title             = COALESCE(${body.title ?? null}, title),
      description       = ${body.description !== undefined ? (body.description ?? null) : sql`description`},
      days_before_start = COALESCE(${body.days_before_start ?? null}, days_before_start),
      position          = COALESCE(${body.position ?? null}, position)
    WHERE id = ${params.itemId} AND template_id = ${params.id}
    RETURNING id, template_id, title, description, position, days_before_start, created_at
  `;
  if (!updated) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await sql`DELETE FROM recruitment_checklist_items WHERE id = ${params.itemId} AND template_id = ${params.id}`;
  return NextResponse.json({ ok: true });
}
