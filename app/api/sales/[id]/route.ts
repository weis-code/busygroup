import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role === 'SELLER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { status } = await req.json();
  const valid = ['PENDING', 'CONFIRMED', 'PAID'];
  if (!valid.includes(status)) {
    return NextResponse.json({ error: 'Ugyldig status' }, { status: 400 });
  }

  const [updated] = await sql`
    UPDATE sales SET status = ${status} WHERE id = ${params.id}
    RETURNING id, status
  `;
  if (!updated) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  return NextResponse.json(updated);
}
