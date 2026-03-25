import Anthropic from '@anthropic-ai/sdk';
import { sql } from '../lib/db';
import { postMessage, postError } from '../lib/slack';
import { randomUUID } from 'crypto';

export const schedule = '0 9 * * 1';

export const systemPrompt = `Du er outreach-agent for BusyConsultings svenske marked.
Du skriver ALTID på svensk. Aldrig dansk eller engelsk.
Produkter:
- AI Receptionist: AI der tager telefonen automatisk
- BusyReminder: Automatiske påmindelser til kunder

Tone: Direkte, kort, værdiorienteret. Aldrig sælgende.
Max 3 sætninger per LinkedIn DM.
Præsenter problemet – ikke produktet.
Nævn aldrig pris.

Du får lead-info og returnerer præcis dette JSON:
{
  "message": "LinkedIn DM på svensk",
  "channel": "linkedin"
}`;

export interface AgentResult {
  success: boolean;
  actions: string[];
  data?: unknown;
  error?: string;
}

export async function run(): Promise<AgentResult> {
  const actions: string[] = [];

  try {
    console.log('[SE Outreach] Starter outreach...');

    const leads = await sql`
      SELECT * FROM leads WHERE status = 'new' AND market = 'sweden' LIMIT 20
    `;

    actions.push(`Fandt ${leads.length} leads til outreach`);

    const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
    const now = new Date();
    let sent = 0;

    for (const lead of leads as Array<Record<string, string>>) {
      try {
        let message = `Hej ${lead.contact_name?.split(' ')[0]}! Vi hjælper virksomheder som ${lead.company} med at automatisere telefonmodtagelse. Har I udfordringer med at besvare alle opkald?`;
        let channel = 'linkedin';

        if (anthropic) {
          const resp = await anthropic.messages.create({
            model: 'claude-opus-4-6',
            max_tokens: 300,
            system: systemPrompt,
            messages: [{
              role: 'user',
              content: `Lead: ${lead.company}, ${lead.contact_name} (${lead.contact_title}). ${lead.why_they_fit}`
            }],
          });
          const text = (resp.content[0] as { text: string }).text;
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            message = parsed.message || message;
            channel = parsed.channel || channel;
          }
        }

        const nextFollowup = new Date(now.getTime() + 5 * 24 * 3600000).toISOString();
        await sql`
          INSERT INTO outreach_sequences (id, lead_id, step, channel, message, sent_at, status, created_at)
          VALUES (${randomUUID()}, ${lead.id}, 1, ${channel}, ${message}, ${now.toISOString()}, 'sent', ${now.toISOString()})
        `;

        await sql`UPDATE leads SET status = 'contacted', updated_at = ${now.toISOString()} WHERE id = ${lead.id}`;

        sent++;
        console.log(`[SE Outreach] Besked forberedt til ${lead.company}`);
      } catch (e) {
        console.error(`[SE Outreach] Fejl for ${lead.company}:`, e);
      }
    }

    actions.push(`${sent} outreach beskeder sendt`);
    await postMessage('agent-salg-sverige', `🇸🇪 Outreach agent: ${sent} LinkedIn DMs sendt til nye svenske leads`);

    await sql`
      INSERT INTO agent_logs (id, agent_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'se-outreach', 'Outreach batch afsluttet', ${`Sendte ${sent}/${leads.length} beskeder`}, 'success', ${now.toISOString()})
    `;

    return { success: true, actions, data: { total: leads.length, sent } };
  } catch (err) {
    const error = String(err);
    await postError('SE Outreach', error);
    await sql`
      INSERT INTO agent_logs (id, agent_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'se-outreach', 'Fejl under outreach', ${error}, 'error', ${new Date().toISOString()})
    `;
    return { success: false, actions, error };
  }
}
