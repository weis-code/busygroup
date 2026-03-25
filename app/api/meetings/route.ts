import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const meetings = await sql`
      SELECT m.*, l.company, l.contact_name, l.contact_title, l.market
      FROM meetings m
      LEFT JOIN leads l ON m.lead_id = l.id
      WHERE m.status != 'cancelled'
      ORDER BY m.scheduled_at ASC
    `;
    return NextResponse.json(meetings);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
