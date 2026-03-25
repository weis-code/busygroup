export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [digest] = await sql`SELECT * FROM daily_digest WHERE date = ${today} ORDER BY created_at DESC LIMIT 1`;

    if (!digest) {
      // Return live data if no digest exists yet
      const urgent = await sql`
        SELECT id, company, contact_name, status, priority
        FROM leads WHERE market='denmark' AND status NOT IN ('won','lost') AND priority='high'
        ORDER BY updated_at DESC LIMIT 5
      `;
      const followUpsDue = await sql`
        SELECT l.id, l.company, l.contact_name, os.channel, os.step
        FROM outreach_sequences os
        JOIN leads l ON l.id = os.lead_id
        WHERE l.market='denmark' AND os.status IN ('draft','pending_send')
        ORDER BY os.sent_at ASC LIMIT 10
      `;
      return NextResponse.json({
        date: today,
        urgent,
        follow_ups_due: followUpsDue,
        meetings_today: [],
        suggested_focus: 'Kør DK Pipeline agent for at generere dagens digest',
        created_at: null,
      });
    }

    return NextResponse.json({
      ...digest,
      urgent: JSON.parse(digest.urgent as string || '[]'),
      follow_ups_due: JSON.parse(digest.follow_ups_due as string || '[]'),
      meetings_today: JSON.parse(digest.meetings_today as string || '[]'),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
