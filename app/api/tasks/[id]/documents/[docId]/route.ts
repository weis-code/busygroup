import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import { userCanAccessTask } from '@/lib/tasks';
import { deleteObject } from '@/lib/storage';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, docId } = await params;
  if (!(await userCanAccessTask(session, id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [doc] = await sql`
    SELECT storage_key FROM task_documents WHERE id = ${docId} AND task_id = ${id}
  `;
  if (!doc) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  await sql`DELETE FROM task_documents WHERE id = ${docId} AND task_id = ${id}`;
  try {
    await deleteObject(doc.storage_key);
  } catch (err) {
    console.error('[tasks/documents] storage delete failed:', err);
  }
  return NextResponse.json({ ok: true });
}
