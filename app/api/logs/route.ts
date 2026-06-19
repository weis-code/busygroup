import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await sql`
    SELECT l.id, l.date::text, l.calls_made, l.contacts_reached,
           l.meetings_booked, l.meetings_held, l.notes, l.created_at,
           t.name AS task_name
    FROM activity_logs l
    JOIN tasks t ON t.id = l.task_id
    WHERE l.user_id = ${session.id}
    ORDER BY l.date DESC, l.created_at DESC
    LIMIT 200
  `;

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { task_id, date, calls_made, contacts_reached, meetings_booked, meetings_held, notes } = body;

  if (!task_id) return NextResponse.json({ error: 'task_id kræves' }, { status: 400 });

  const calls = Number(calls_made) || 0;
  const contacts = Number(contacts_reached) || 0;
  const booked = Number(meetings_booked) || 0;
  const held = Number(meetings_held) || 0;

  if (contacts > calls) {
    return NextResponse.json({ error: 'Kontakter nået kan ikke overstige opkald foretaget' }, { status: 400 });
  }
  if (booked > contacts) {
    return NextResponse.json({ error: 'Møder booket kan ikke overstige kontakter nået' }, { status: 400 });
  }

  const logDate = date || new Date().toISOString().slice(0, 10);

  const [log] = await sql`
    INSERT INTO activity_logs (user_id, task_id, date, calls_made, contacts_reached, meetings_booked, meetings_held, notes)
    VALUES (${session.id}, ${task_id}, ${logDate}, ${calls}, ${contacts}, ${booked}, ${held}, ${notes ?? null})
    RETURNING id, date::text, calls_made, contacts_reached, meetings_booked, meetings_held, notes
  `;

  return NextResponse.json(log, { status: 201 });
}
