import Anthropic from '@anthropic-ai/sdk';
import { sql } from '../lib/db';
import { postLeadsFound, postError } from '../lib/slack';
import { randomUUID } from 'crypto';

export const schedule = '0 8 * * 1';

export const systemPrompt = `Du er prospecting-agent for BusyConsultings svenske marked.
Ideelle kunder:
- Klinikker: tandlæger, fysioterapeuter, psykologer, kiropraktorer, skønhedsklinikker
- Håndværkere: VVS, el-installatører, tømrere, malere
- Størrelse: 1-20 ansatte, ejerlede
- Geografi: Stockholm, Göteborg, Malmö

Returner KUN et JSON array med præcis 20 leads.
Ingen anden tekst. Format per lead:
{
  "company": "firmanavn",
  "contact_name": "fulde navn",
  "contact_title": "titel",
  "linkedin_url": "https://linkedin.com/in/...",
  "email": null,
  "phone": null,
  "company_size": "3-5 ansatte",
  "why_they_fit": "2-3 sætninger",
  "priority": "high"
}
Leads skal være realistiske svenske virksomheder.
Variér mellem klinikker og håndværkere.
Variér geografi mellem Stockholm, Göteborg og Malmö.`;

export interface AgentResult {
  success: boolean;
  actions: string[];
  data?: unknown;
  error?: string;
}

export async function run(): Promise<AgentResult> {
  const actions: string[] = [];

  try {
    console.log('[SE Prospecting] Starter lead-søgning...');

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

    let leads: Array<Record<string, string | null>> = [];

    if (process.env.ANTHROPIC_API_KEY) {
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Generer 20 nye svenske leads til BusyConsultings pipeline.' }],
      });

      const text = (response.content[0] as { text: string }).text;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        leads = JSON.parse(jsonMatch[0]);
        actions.push(`Claude genererede ${leads.length} leads`);
      }
    } else {
      actions.push('Mock leads genereret (ingen API nøgle)');
      leads = [];
    }

    // Deduplicate
    const existing = await sql`SELECT company FROM leads WHERE market = 'sweden'`;
    const existingNames = new Set((existing as unknown as Array<{ company: string }>).map(l => l.company.toLowerCase()));

    let inserted = 0;
    const now = new Date().toISOString();
    for (const lead of leads) {
      if (existingNames.has(String(lead.company).toLowerCase())) continue;
      await sql`
        INSERT INTO leads (id, company, contact_name, contact_title, linkedin_url, email, phone, company_size, why_they_fit, priority, status, market, created_at, updated_at)
        VALUES (${randomUUID()}, ${lead.company}, ${lead.contact_name}, ${lead.contact_title}, ${lead.linkedin_url}, ${lead.email}, ${lead.phone}, ${lead.company_size}, ${lead.why_they_fit}, ${lead.priority || 'medium'}, 'new', 'sweden', ${now}, ${now})
      `;
      inserted++;
    }

    actions.push(`${inserted} nye leads indsat i database`);

    await postLeadsFound(inserted, 'sweden');
    actions.push('Slack notifikation sendt');

    await sql`
      INSERT INTO agent_logs (id, agent_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'se-prospecting', 'Lead-søgning afsluttet', ${`Fandt ${leads.length} leads, indsatte ${inserted} nye`}, 'success', ${now})
    `;

    return { success: true, actions, data: { found: leads.length, inserted } };
  } catch (err) {
    const error = String(err);
    await postError('SE Prospecting', error);
    await sql`
      INSERT INTO agent_logs (id, agent_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'se-prospecting', 'Fejl under prospecting', ${error}, 'error', ${new Date().toISOString()})
    `;
    return { success: false, actions, error };
  }
}
