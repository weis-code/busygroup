import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// PATCH — opdater label og/eller position
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 });
  }

  const { label, position } = await req.json() as { label?: string; position?: number };

  if (label !== undefined) {
    await sql`UPDATE pipeline_stages SET label = ${label.trim()} WHERE id = ${params.id}`;
  }
  if (position !== undefined) {
    await sql`UPDATE pipeline_stages SET position = ${position} WHERE id = ${params.id}`;
  }

  const [stage] = await sql`SELECT id, label, position FROM pipeline_stages WHERE id = ${params.id}`;
  if (!stage) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  return NextResponse.json(stage);
}

// DELETE — slet stadie (kun hvis ingen leads har dette status)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 });
  }

  // Check for leads with this status
  const [{ cnt }] = await sql`SELECT COUNT(*) as cnt FROM leads WHERE status = ${params.id}` as unknown as Array<{ cnt: string }>;
  if (Number(cnt) > 0) {
    return NextResponse.json(
      { error: `Kan ikke slette — ${cnt} lead(s) er i dette stadie. Flyt dem først.` },
      { status: 409 }
    );
  }

  await sql`DELETE FROM pipeline_stages WHERE id = ${params.id}`;
  return NextResponse.json({ ok: true });
}
