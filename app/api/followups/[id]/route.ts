import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { status, assigned_to } = await req.json();

  const [updated] = await sql`
    UPDATE followups SET
      status = COALESCE(${status ?? null}, status),
      assigned_to = CASE WHEN ${assigned_to !== undefined} THEN ${assigned_to ?? null} ELSE assigned_to END,
      resolved_at = CASE WHEN ${status ?? ''} = 'RESOLVED' THEN NOW()
                         WHEN ${status ?? ''} IN ('OPEN','IN_PROGRESS') THEN NULL
                         ELSE resolved_at END
    WHERE id = ${params.id}
    RETURNING id, status, assigned_to, resolved_at
  `;

  if (!updated) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  return NextResponse.json(updated);
}
