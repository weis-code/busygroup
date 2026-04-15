import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// PATCH — opdater label og/eller position (identificeret ved pk UUID)
export async function PATCH(req: NextRequest, { params }: { params: { pk: string } }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 });
  }

  const { label, position } = await req.json() as { label?: string; position?: number };

  if (label !== undefined) {
    await sql`UPDATE pipeline_stages SET label = ${label.trim()} WHERE pk = ${params.pk}`;
  }
  if (position !== undefined) {
    await sql`UPDATE pipeline_stages SET position = ${position} WHERE pk = ${params.pk}`;
  }

  const [stage] = await sql`SELECT pk, id, label, position FROM pipeline_stages WHERE pk = ${params.pk}`;
  if (!stage) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  return NextResponse.json(stage);
}

// DELETE — slet stadie (kun hvis ingen leads i dette workspace har status)
export async function DELETE(_req: NextRequest, { params }: { params: { pk: string } }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 });
  }

  // Find stage details
  const rows = await sql`SELECT pk, id, workspace_id FROM pipeline_stages WHERE pk = ${params.pk}` as unknown as Array<{ pk: string; id: string; workspace_id: string | null }>;
  if (!rows.length) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  const stage = rows[0];

  // Check leads only in the same workspace
  const cntRows = stage.workspace_id
    ? await sql`SELECT COUNT(*) as cnt FROM leads WHERE status = ${stage.id} AND workspace_id = ${stage.workspace_id}` as unknown as Array<{ cnt: string }>
    : await sql`SELECT COUNT(*) as cnt FROM leads WHERE status = ${stage.id} AND workspace_id IS NULL` as unknown as Array<{ cnt: string }>;

  if (Number(cntRows[0].cnt) > 0) {
    return NextResponse.json(
      { error: `Kan ikke slette — ${cntRows[0].cnt} lead(s) er i dette stadie. Flyt dem først.` },
      { status: 409 }
    );
  }

  await sql`DELETE FROM pipeline_stages WHERE pk = ${params.pk}`;
  return NextResponse.json({ ok: true });
}
