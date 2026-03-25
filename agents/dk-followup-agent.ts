import Anthropic from '@anthropic-ai/sdk';
import { sql } from '../lib/db';
import { randomUUID } from 'crypto';

export const schedule = ''; // Triggered by dk-calllog or manually

export interface AgentResult {
  success: boolean;
  actions: string[];
  data?: unknown;
  error?: string;
}

const systemPrompt = `Du er follow-up agent for BusyConsultings danske salgsteam.
Du skriver ALTID på dansk.

Baseret på opkaldsnotater genererer du et opfølgningsudkast.
Returner præcis dette JSON:
{
  "channel": "email | linkedin",
  "subject": "Emnelinjen (kun ved email)",
  "message": "Beskedteksten – max 100 ord, personlig, ikke sælgende",
  "angle": "Kort forklaring: hvorfor denne vinkel"
}

Regler:
- Referer til noget specifikt fra opkaldet
- Nævn aldrig pris
- Tonen er menneskelig og professionel
- Email: formelt, men venligt
- LinkedIn: kortere, mere uformelt`;

export async function runForLead(leadId: string, callSummary: string): Promise<AgentResult> {
  const actions: string[] = [];
  const now = new Date().toISOString();

  try {
    const [lead] = await sql`SELECT * FROM leads WHERE id = ${leadId}`;
    if (!lead) throw new Error(`Lead ${leadId} ikke fundet`);

    const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

    let draft: Record<string, unknown> = {
      channel: 'email',
      subject: `Opfølgning på vores samtale – ${lead.company}`,
      message: `Hej ${String(lead.contact_name).split(' ')[0]},\n\nTak for en god snak. Som lovet sender jeg en kort opfølgning.\n\n${callSummary}\n\nKan vi aftale 20 minutter til at dykke ned i det?\n\nMed venlig hilsen`,
      angle: 'Direkte opfølgning på opkaldet',
    };

    if (anthropic) {
      const resp = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Lead: ${lead.company} (${lead.contact_name}, ${lead.contact_title})
Status: ${lead.status}

Opsummering af opkaldet:
"${callSummary}"

Skriv et opfølgningsudkast der refererer specifikt til dette opkald.`,
        }],
      });
      const text = (resp.content[0] as { text: string }).text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) draft = JSON.parse(jsonMatch[0]);
    }

    // Save as draft in outreach_sequences
    const [existingSeqs] = await sql`SELECT COUNT(*) as c FROM outreach_sequences WHERE lead_id = ${leadId}`;
    const nextStep = Number(existingSeqs.c) + 1;

    await sql`
      INSERT INTO outreach_sequences (id, lead_id, step, channel, message, status, created_at)
      VALUES (${randomUUID()}, ${leadId}, ${nextStep}, ${draft.channel as string}, ${draft.channel === 'email' ? `EMNE: ${draft.subject}\n\n${draft.message}` : draft.message as string}, 'draft', ${now})
    `;

    // Update lead flag
    await sql`UPDATE leads SET followup_draft_ready = 1, updated_at = ${now} WHERE id = ${leadId}`;

    // Log it
    await sql`
      INSERT INTO agent_logs (id, agent_id, lead_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'dk-followup', ${leadId}, 'Opfølgningsudkast klar', ${`${draft.channel} udkast klar til godkendelse for ${lead.company}`}, 'success', ${now})
    `;

    actions.push(`Opfølgningsudkast (${draft.channel}) gemt som kladde`);
    return { success: true, actions, data: draft };
  } catch (err) {
    const error = String(err);
    await sql`
      INSERT INTO agent_logs (id, agent_id, lead_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'dk-followup', ${leadId}, 'Fejl ved opfølgning', ${error}, 'error', ${now})
    `;
    return { success: false, actions, error };
  }
}

export async function run(): Promise<AgentResult> {
  return { success: true, actions: ['dk-followup startes via dk-calllog eller manuelt'], data: null };
}
