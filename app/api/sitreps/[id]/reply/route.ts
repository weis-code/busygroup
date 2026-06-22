import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: 'Besked kræves' }, { status: 400 });

  const [reply] = await sql`
    INSERT INTO sitrep_replies (sitrep_id, user_id, body)
    VALUES (${params.id}, ${session.id}, ${body.trim()})
    RETURNING id, body, created_at
  `;

  return NextResponse.json(reply, { status: 201 });
}
