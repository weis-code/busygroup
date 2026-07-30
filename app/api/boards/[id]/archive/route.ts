import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import { getBoardAccess } from '@/lib/boards';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const access = await getBoardAccess(session, id);
  if (!access || access.role !== 'owner') return NextResponse.json({ error: 'Kun ejeren kan arkivere boardet' }, { status: 403 });

  await sql`UPDATE boards SET is_archived = true, updated_at = NOW() WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const access = await getBoardAccess(session, id);
  if (!access || access.role !== 'owner') return NextResponse.json({ error: 'Kun ejeren kan genskabe boardet' }, { status: 403 });

  await sql`UPDATE boards SET is_archived = false, updated_at = NOW() WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
