import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; userId: string } }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Kun admin' }, { status: 403 });
  await sql`DELETE FROM sc_client_sellers WHERE client_id = ${params.id} AND user_id = ${params.userId}`;
  return NextResponse.json({ ok: true });
}
