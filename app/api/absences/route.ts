import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (session.role === 'SELLER') {
    const absences = await sql`
      SELECT id, type, start_date::text, end_date::text, note, status, created_at
      FROM absences
      WHERE user_id = ${session.id}
      ORDER BY start_date DESC
    `;
    return NextResponse.json(absences);
  }

  const absences = await sql`
    SELECT a.id, a.type, a.start_date::text, a.end_date::text, a.note, a.status,
           a.created_at, u.name AS user_name, u.id AS user_id,
           cb.name AS created_by_name
    FROM absences a
    JOIN users u ON u.id = a.user_id
    JOIN users cb ON cb.id = a.created_by
    ORDER BY a.start_date DESC
  `;
  return NextResponse.json(absences);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { user_id, type, start_date, end_date, note } = await req.json();

  if (!['VACATION', 'SICK', 'OTHER'].includes(type)) {
    return NextResponse.json({ error: 'Ugyldig fraværstype' }, { status: 400 });
  }
  if (!start_date || !end_date) {
    return NextResponse.json({ error: 'start_date og end_date er påkrævet' }, { status: 400 });
  }

  const targetUserId = (session.role !== 'SELLER' && user_id) ? user_id : session.id;
  // Admin/manager creating on behalf of someone → auto-approve
  const status = (session.role !== 'SELLER' && user_id && user_id !== session.id) ? 'APPROVED' : 'PENDING';

  const [absence] = await sql`
    INSERT INTO absences (user_id, type, start_date, end_date, note, status, created_by)
    VALUES (${targetUserId}, ${type}, ${start_date}, ${end_date}, ${note ?? null}, ${status}, ${session.id})
    RETURNING id, type, start_date::text, end_date::text, note, status, created_at
  `;

  return NextResponse.json(absence, { status: 201 });
}
