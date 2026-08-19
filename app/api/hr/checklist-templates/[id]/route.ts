import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as { name?: string; company_id?: number | null };

  const [updated] = await sql`
    UPDATE recruitment_checklist_templates SET
      name       = COALESCE(${body.name ?? null}, name),
      company_id = ${body.company_id !== undefined ? (body.company_id ?? null) : sql`company_id`}
    WHERE id = ${params.id}
    RETURNING id, name, company_id, created_by, created_at
  `;
  if (!updated) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await sql`DELETE FROM recruitment_checklist_templates WHERE id = ${params.id}`;
  return NextResponse.json({ ok: true });
}
