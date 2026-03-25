import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [stats] = await sql`
      SELECT
        COUNT(*) as total_leads,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_leads,
        SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted,
        SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replied,
        SUM(CASE WHEN status = 'interested' THEN 1 ELSE 0 END) as interested,
        SUM(CASE WHEN status = 'booked' THEN 1 ELSE 0 END) as booked,
        SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won,
        SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lost
      FROM leads WHERE status != 'deleted'
    `;

    const [meetingsThisWeek] = await sql`
      SELECT COUNT(*) as count FROM meetings
      WHERE scheduled_at >= NOW() - INTERVAL '7 days'
      AND status != 'cancelled'
    `;

    const [outreachSent] = await sql`
      SELECT COUNT(*) as count FROM outreach_sequences WHERE status = 'sent'
    `;

    const total = Number(stats.total_leads) || 1;
    const converted = (Number(stats.interested) || 0) + (Number(stats.booked) || 0) + (Number(stats.won) || 0);

    return NextResponse.json({
      new: Number(stats.new_leads) || 0,
      contacted: Number(stats.contacted) || 0,
      replied: Number(stats.replied) || 0,
      interested: Number(stats.interested) || 0,
      booked: Number(stats.booked) || 0,
      won: Number(stats.won) || 0,
      lost: Number(stats.lost) || 0,
      total_leads: Number(stats.total_leads) || 0,
      meetings_this_week: Number(meetingsThisWeek.count) || 0,
      outreach_sent: Number(outreachSent.count) || 0,
      conversion_rate: Math.round((converted / total) * 100),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
