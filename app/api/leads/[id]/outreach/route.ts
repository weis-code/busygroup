export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sendEmail, textToHtml } from '@/lib/email';

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
      // Fetch the sequence step + lead email details
      const [seq] = await sql`SELECT * FROM outreach_sequences WHERE id = ${seq_id} AND lead_id = ${params.id}`;
      if (!seq) return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });

      const [lead] = await sql`SELECT email, contact_name, company FROM leads WHERE id = ${params.id}`;

      // Only attempt email send if channel is 'email' and we have a recipient
      if (seq.channel === 'email' && lead?.email) {
        try {
          await sendEmail({
            to: lead.email,
            subject: seq.subject || `Hej ${lead.contact_name?.split(' ')[0] || lead.company}`,
            html: textToHtml(seq.message),
            text: seq.message,
          });
        } catch (emailErr) {
          console.error('Email send failed:', emailErr);
          // Don't block the approve — log the error and continue
        }
      }

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
