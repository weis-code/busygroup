import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const [leadsRow] = await sql`
      SELECT COUNT(*) as cnt FROM leads
      WHERE country = 'SE' AND created_at >= ${today}
    `;

    const [lastRunRow] = await sql`
      SELECT last_run, runs_today FROM agents WHERE id = 'se-prospecting'
    ` as unknown as Array<{ last_run: string | null; runs_today: number }>;

    const [totalRunsRow] = await sql`
      SELECT COUNT(*) as cnt FROM agent_logs WHERE agent_id = 'se-prospecting'
    `;

    return NextResponse.json({
      leadsToday: Number(leadsRow?.cnt ?? 0),
      lastRun: lastRunRow?.last_run ?? null,
      totalRuns: Number(totalRunsRow?.cnt ?? 0),
    });
  } catch (err) {
    return NextResponse.json({ leadsToday: 0, lastRun: null, totalRuns: 0, error: String(err) });
  }
}
