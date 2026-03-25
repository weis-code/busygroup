import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const logs = await sql`SELECT *, 'log' as type FROM agent_logs WHERE lead_id = ${params.id}`;
    const sequences = await sql`SELECT *, 'sequence' as type FROM outreach_sequences WHERE lead_id = ${params.id}`;
    const meetings = await sql`SELECT *, 'meeting' as type FROM meetings WHERE lead_id = ${params.id}`;
    const notes = await sql`SELECT *, 'note' as type FROM notes WHERE lead_id = ${params.id}`;

    type Row = Record<string, unknown> & { sort_at?: unknown };
    const all: Row[] = [
      ...(logs as Row[]).map(l => ({ ...l, sort_at: l.created_at })),
      ...(sequences as Row[]).map(s => ({ ...s, sort_at: s.sent_at || s.created_at })),
      ...(meetings as Row[]).map(m => ({ ...m, sort_at: m.created_at })),
      ...(notes as Row[]).map(n => ({ ...n, sort_at: n.created_at })),
    ].sort((a, b) => String(b.sort_at || '').localeCompare(String(a.sort_at || '')));

    return NextResponse.json(all);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
