import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import { deleteObject } from '@/lib/storage';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const [call] = await sql`
    SELECT id, task_id, filename, status, duration_seconds, transcript, feedback, error, created_at
    FROM sales_calls WHERE id = ${id} AND seller_id = ${session.id}
  `;
  if (!call) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  return NextResponse.json(call);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const [call] = await sql`SELECT storage_key FROM sales_calls WHERE id = ${id} AND seller_id = ${session.id}`;
  if (!call) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  await sql`DELETE FROM sales_calls WHERE id = ${id} AND seller_id = ${session.id}`;
  try {
    await deleteObject(call.storage_key);
  } catch (err) {
    console.error('[sales-calls] storage delete failed:', err);
  }
  return NextResponse.json({ ok: true });
}
