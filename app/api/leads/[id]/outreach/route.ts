export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sequences = await sql`
      SELECT * FROM outreach_sequences WHERE lead_id = ${params.id} ORDER BY step ASC
    `;
    return NextResponse.json(sequences);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { seq_id, action, message } = await req.json();
    const now = new Date().toISOString();

    if (action === 'approve') {
      await sql`UPDATE outreach_sequences SET status = 'sent', sent_at = ${now} WHERE id = ${seq_id} AND lead_id = ${params.id}`;
    } else if (action === 'skip') {
      await sql`UPDATE outreach_sequences SET status = 'skipped' WHERE id = ${seq_id} AND lead_id = ${params.id}`;
    } else if (action === 'edit' && message) {
      await sql`UPDATE outreach_sequences SET message = ${message} WHERE id = ${seq_id} AND lead_id = ${params.id}`;
    } else if (action === 'pause') {
      await sql`UPDATE outreach_sequences SET status = 'paused' WHERE lead_id = ${params.id} AND status IN ('scheduled','draft','pending_send')`;
    } else if (action === 'resume') {
      await sql`UPDATE outreach_sequences SET status = 'scheduled' WHERE lead_id = ${params.id} AND status = 'paused'`;
    } else if (action === 'stop') {
      await sql`UPDATE outreach_sequences SET status = 'stopped' WHERE lead_id = ${params.id} AND status NOT IN ('sent','replied')`;
      await sql`UPDATE leads SET nurture_active = 0, followup_draft_ready = 0 WHERE id = ${params.id}`;
    }

    const updated = await sql`SELECT * FROM outreach_sequences WHERE lead_id = ${params.id} ORDER BY step ASC`;
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
