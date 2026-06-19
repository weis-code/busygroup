import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rows = await sql`
    SELECT id, name, start_date::text, end_date::text, created_at
    FROM pay_periods ORDER BY start_date DESC
  `;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, start_date, end_date } = await req.json();
  if (!name || !start_date || !end_date) {
    return NextResponse.json({ error: 'Navn, startdato og slutdato kræves' }, { status: 400 });
  }

  const [row] = await sql`
    INSERT INTO pay_periods (name, start_date, end_date)
    VALUES (${name}, ${start_date}, ${end_date})
    RETURNING id, name, start_date::text, end_date::text
  `;
  return NextResponse.json(row, { status: 201 });
}
