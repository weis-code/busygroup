import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [absence] = await sql`SELECT * FROM absences WHERE id = ${params.id}`;
  if (!absence) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  if (session.role === 'SELLER') {
    if (absence.user_id !== session.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (absence.status !== 'PENDING') return NextResponse.json({ error: 'Kan kun redigere afventende anmodninger' }, { status: 400 });

    const { type, start_date, end_date, note } = await req.json();
    const [updated] = await sql`
      UPDATE absences SET
        type = COALESCE(${type ?? null}, type),
        start_date = COALESCE(${start_date ?? null}::date, start_date),
        end_date = COALESCE(${end_date ?? null}::date, end_date),
        note = ${note ?? absence.note}
      WHERE id = ${params.id}
      RETURNING id, type, start_date::text, end_date::text, note, status
    `;
    return NextResponse.json(updated);
  }

  // Admin/manager: can approve/reject or fully edit
  const { status, type, start_date, end_date, note } = await req.json();
  if (status && !['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
    return NextResponse.json({ error: 'Ugyldig status' }, { status: 400 });
  }

  const [updated] = await sql`
    UPDATE absences SET
      status = COALESCE(${status ?? null}, status),
      type = COALESCE(${type ?? null}, type),
      start_date = COALESCE(${start_date ?? null}::date, start_date),
      end_date = COALESCE(${end_date ?? null}::date, end_date),
      note = COALESCE(${note ?? null}, note)
    WHERE id = ${params.id}
    RETURNING id, type, start_date::text, end_date::text, note, status
  `;
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [absence] = await sql`SELECT * FROM absences WHERE id = ${params.id}`;
  if (!absence) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  if (session.role === 'SELLER') {
    if (absence.user_id !== session.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (absence.status !== 'PENDING') return NextResponse.json({ error: 'Kan kun slette afventende anmodninger' }, { status: 400 });
  }

  await sql`DELETE FROM absences WHERE id = ${params.id}`;
  return NextResponse.json({ ok: true });
}
