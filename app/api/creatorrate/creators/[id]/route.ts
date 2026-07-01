import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { status, notes } = await req.json() as { status?: string; notes?: string };

  await sql`
    INSERT INTO cr_creator_status (creator_id, status, notes, updated_by, updated_at)
    VALUES (${id}, ${status ?? 'active'}, ${notes ?? null}, ${session.id}, NOW())
    ON CONFLICT (creator_id) DO UPDATE SET
      status     = EXCLUDED.status,
      notes      = EXCLUDED.notes,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
  `;

  return NextResponse.json({ ok: true });
}
