import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// PATCH — rename / recolor column
export async function PATCH(req: NextRequest, { params }: { params: { id: string; colId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const body = await req.json();
  if ('name' in body)     await sql`UPDATE project_columns SET name     = ${body.name}     WHERE id = ${params.colId} AND board_id = ${params.id}`;
  if ('color' in body)    await sql`UPDATE project_columns SET color    = ${body.color}    WHERE id = ${params.colId} AND board_id = ${params.id}`;
  if ('position' in body) await sql`UPDATE project_columns SET position = ${body.position} WHERE id = ${params.colId} AND board_id = ${params.id}`;

  return NextResponse.json({ ok: true });
}

// DELETE — remove column (tasks moved to first column or deleted)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string; colId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  // Delete tasks in this column first
  await sql`DELETE FROM project_tasks WHERE column_id = ${params.colId}`;
  await sql`DELETE FROM project_columns WHERE id = ${params.colId} AND board_id = ${params.id}`;

  return NextResponse.json({ ok: true });
}
