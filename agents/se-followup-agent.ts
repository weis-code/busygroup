import Anthropic from '@anthropic-ai/sdk';
import { sql } from '../lib/db';
import { postMessage, postError } from '../lib/slack';
import { randomUUID } from 'crypto';

export const schedule = '30 8 * * *';

export const systemPrompt = `Du er follow-up agent for BusyConsultings svenske marked.
Du skriver ALTID på svensk.

Sekvens:
- Trin 2 (dag 5): Ny vinkel, max 2 sætninger
- Trin 3 (dag 10): Email, konkret eksempel fra branche
- Trin 4 (dag 15): Break-up besked, efterlad døren åben

Du får lead-info + trin-nummer og returnerer:
{
  "message": "besked på svensk",
  "channel": "linkedin"
}

Stop ALTID sekvensen hvis lead har svaret negativt.
Max 4 kontaktpunkter total inkl. første outreach.
Inkluder altid opt-out mulighed.`;

export interface AgentResult {
  success: boolean;
  actions: string[];
  data?: unknown;
  error?: string;
}

export async function run(): Promise<AgentResult> {
  const actions: string[] = [];

  try {
    console.log('[SE Follow-up] Starter follow-up tjek...');

    const sequences = await sql`
      SELECT os.*, l.company, l.contact_name, l.contact_title, l.why_they_fit
      FROM outreach_sequences os
      JOIN leads l ON os.lead_id = l.id
      WHERE os.sent_at <= NOW() - INTERVAL '5 days'
      AND os.status = 'sent'
      AND l.status = 'contacted'
      AND l.market = 'sweden'
    `;

    actions.push(`${sequences.length} follow-up opgaver fundet`);

    const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
    const now = new Date();
    let processed = 0;
    let stopped = 0;

    for (const seq of sequences as Array<Record<string, string | number>>) {
      const nextStep = Number(seq.step) + 1;

      if (nextStep > 4) {
        await sql`UPDATE outreach_sequences SET status = 'stopped' WHERE id = ${seq.id}`;
        await sql`UPDATE leads SET status = 'lost', updated_at = ${now.toISOString()} WHERE id = ${seq.lead_id}`;
        stopped++;
        continue;
      }

      let message = `Hej ${String(seq.contact_name).split(' ')[0]}! Blot en kort påmindelse om vores tidligere besked. Ønsker du at vi fjerner dig fra listen, svar blot nej.`;
      let channel = 'linkedin';

      if (anthropic) {
        try {
          const resp = await anthropic.messages.create({
            model: 'claude-opus-4-6',
            max_tokens: 300,
            system: systemPrompt,
            messages: [{
              role: 'user',
              content: `Lead: ${seq.company}, ${seq.contact_name} (${seq.contact_title}). Trin: ${nextStep}. ${seq.why_they_fit}`
            }],
          });
          const text = (resp.content[0] as { text: string }).text;
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            message = parsed.message || message;
            channel = parsed.channel || channel;
          }
        } catch (e) {
          console.error('[SE Follow-up] API fejl:', e);
        }
      }

      await sql`
        INSERT INTO outreach_sequences (id, lead_id, step, channel, message, sent_at, status, created_at)
        VALUES (${randomUUID()}, ${seq.lead_id}, ${nextStep}, ${channel}, ${message}, ${now.toISOString()}, 'sent', ${now.toISOString()})
      `;

      await sql`UPDATE outreach_sequences SET status = 'replied' WHERE id = ${seq.id}`;
      processed++;
    }

    actions.push(`${processed} follow-ups sendt, ${stopped} sekvenser stoppet`);
    await postMessage('agent-salg-sverige', `🇸🇪 Follow-up agent: ${processed} follow-ups sendt, ${stopped} sekvenser lukket`);

    await sql`
      INSERT INTO agent_logs (id, agent_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'se-followup', 'Follow-up batch afsluttet', ${`${processed} sendt, ${stopped} stoppet af ${sequences.length} kandidater`}, 'success', ${now.toISOString()})
    `;

    return { success: true, actions, data: { processed, stopped, total: sequences.length } };
  } catch (err) {
    const error = String(err);
    await postError('SE Follow-up', error);
    await sql`
      INSERT INTO agent_logs (id, agent_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'se-followup', 'Fejl under follow-up', ${error}, 'error', ${new Date().toISOString()})
    `;
    return { success: false, actions, error };
  }
}
