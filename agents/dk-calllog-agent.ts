import Anthropic from '@anthropic-ai/sdk';
import { sql } from '../lib/db';
import { randomUUID } from 'crypto';

export const schedule = ''; // No cron – triggered manually only

export interface AgentResult {
  success: boolean;
  actions: string[];
  data?: unknown;
  error?: string;
}

const systemPrompt = `Du er call-log agent for BusyConsultings danske salgsteam.
Du analyserer en sælgers opkaldsnoter og returnerer et struktureret JSON-output.

Returner præcis dette JSON:
{
  "summary": "Kort opsummering på 1-2 sætninger",
  "outcome": "interested | not_interested | callback | booked | objection | voicemail | no_answer",
  "next_status": "replied | interested | booked | contacted | lost",
  "sentiment": "positive | neutral | negative",
  "key_points": ["vigtigste punkt fra opkaldet"],
  "next_action": "Konkret næste handling sælgeren skal tage",
  "callback_date": "ISO dato hvis callback aftalt, ellers null",
  "trigger_followup": true/false
}

Regler:
- outcome 'booked': der er aftalt et møde
- outcome 'interested': de vil gerne vide mere, men møde ikke aftalt endnu
- outcome 'callback': de vil gerne ringes op igen på en specifik dato
- trigger_followup = true når: interested, callback, eller positive sentiment
- next_status bestemmes ud fra outcome`;

export async function runForLead(leadId: string, callMessage: string): Promise<AgentResult> {
  const actions: string[] = [];
  const now = new Date().toISOString();

  try {
    const [lead] = await sql`SELECT * FROM leads WHERE id = ${leadId}`;
    if (!lead) throw new Error(`Lead ${leadId} ikke fundet`);

    const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

    let parsed: Record<string, unknown> = {
      summary: callMessage,
      outcome: 'interested',
      next_status: 'interested',
      sentiment: 'positive',
      key_points: [callMessage],
      next_action: 'Send opfølgningsemail',
      callback_date: null,
      trigger_followup: true,
    };

    if (anthropic) {
      const resp = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 600,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Lead: ${lead.company} (${lead.contact_name})
Nuværende status: ${lead.status}

Sælgerens opkaldsnoter:
"${callMessage}"`,
        }],
      });
      const text = (resp.content[0] as { text: string }).text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    }

    const newStatus = (parsed.next_status as string) || String(lead.status);

    // 1. Update lead status
    await sql`UPDATE leads SET status = ${newStatus}, updated_at = ${now} WHERE id = ${leadId}`;
    actions.push(`Status opdateret til ${newStatus}`);

    // 2. Log the call in agent_logs
    await sql`
      INSERT INTO agent_logs (id, agent_id, lead_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'dk-calllog', ${leadId}, 'Opkald logget', ${JSON.stringify(parsed)}, 'success', ${now})
    `;

    // 3. Save to notes table with structured content
    await sql`
      INSERT INTO notes (id, lead_id, content, created_by, created_at)
      VALUES (${randomUUID()}, ${leadId}, ${`📞 OPKALD: ${callMessage}\n\nUdfald: ${parsed.outcome}\nNæste handling: ${parsed.next_action}`}, 'sælger', ${now})
    `;

    // 4. Handle callback reminder
    if (parsed.callback_date) {
      await sql`
        INSERT INTO notes (id, lead_id, content, created_by, created_at)
        VALUES (${randomUUID()}, ${leadId}, ${`📅 CALLBACK AFTALT: Ring igen ${parsed.callback_date}`}, 'dk-calllog-agent', ${now})
      `;
      actions.push(`Callback-reminder oprettet: ${parsed.callback_date}`);
    }

    // 5. Trigger followup agent if needed
    if (parsed.trigger_followup) {
      const { runForLead: prepFollowup } = await import('./dk-followup-agent');
      await prepFollowup(leadId, String(parsed.summary || callMessage));
      actions.push('Opfølgningsudkast genereret');
    }

    return { success: true, actions, data: parsed };
  } catch (err) {
    const error = String(err);
    await sql`
      INSERT INTO agent_logs (id, agent_id, lead_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'dk-calllog', ${leadId}, 'Fejl ved opkaldslog', ${error}, 'error', ${now})
    `;
    return { success: false, actions, error };
  }
}

export async function run(): Promise<AgentResult> {
  return { success: true, actions: ['dk-calllog startes manuelt via API'], data: null };
}
