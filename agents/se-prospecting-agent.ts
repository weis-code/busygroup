import Anthropic from '@anthropic-ai/sdk';
import { sql } from '../lib/db';
import { postLeadsFound, postError } from '../lib/slack';
import { randomUUID } from 'crypto';

export const schedule = '0 8 * * 1'; // Mandage kl. 8

export const systemPrompt = `Du er prospecting-agent for BusyConsultings svenske marked.
Ideelle kunder:
- Klinikker: tandläkare, fysioterapeuter, psykologer, kiropraktorer, skönhetskliniker
- Hantverkare: VVS, el-installatörer, snickare, målare
- Storlek: 1-20 anställda, ägarledda
- Geografi: Stockholm, Göteborg, Malmö

Returner KUN et JSON array med præcis 20 leads. Ingen anden tekst.
Format per lead:
{
  "company": "firmanamn",
  "contact_name": "fullt namn",
  "contact_title": "titel (t.ex. Ägare, VD, Klinikchef)",
  "email": "info@firmanamn.se ELLER fornamn.efternamn@firmanamn.se",
  "phone": null,
  "linkedin_url": null,
  "company_size": "3-8 anställda",
  "why_they_fit": "2-3 meningar på danska om varför de passar",
  "priority": "high",
  "city": "Stockholm"
}

Emails: Brug info@[company].se for kliniker, [fornavn].[efternavn]@[company].se for håndværkere.
Gör domänerna realistiska: fjordatandvård.se, stockholmsrörmokare.se, lindgrens-el.se osv.
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
        model: 'claude-opus-4-5',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Generera 20 nye svenske leads till BusyConsultings pipeline.' }],
      });

      const text = (response.content[0] as { text: string }).text;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        leads = JSON.parse(jsonMatch[0]);
        actions.push(`Claude genererede ${leads.length} leads`);
      }
    } else {
      actions.push('Ingen ANTHROPIC_API_KEY — springer over');
      return { success: false, actions, error: 'ANTHROPIC_API_KEY mangler' };
    }

    // Dedupliker på company-navn
    const existing = await sql`SELECT company FROM leads WHERE market = 'sweden'`;
    const existingNames = new Set((existing as unknown as Array<{ company: string }>).map(l => l.company.toLowerCase()));

    let inserted = 0;
    const now = new Date().toISOString();

    for (const lead of leads) {
      if (existingNames.has(String(lead.company).toLowerCase())) continue;
      await sql`
        INSERT INTO leads (
          id, company, contact_name, contact_title, linkedin_url, email, phone,
          company_size, why_they_fit, priority, status, market, created_at, updated_at
        )
        VALUES (
          ${randomUUID()}, ${lead.company}, ${lead.contact_name}, ${lead.contact_title},
          ${lead.linkedin_url || null}, ${lead.email || null}, ${lead.phone || null},
          ${lead.company_size}, ${lead.why_they_fit}, ${lead.priority || 'high'},
          'new', 'sweden', ${now}, ${now}
        )
      `;
      inserted++;
    }

    actions.push(`${inserted} nye leads indsat i database`);
    await postLeadsFound(inserted, 'sweden');
    actions.push('Slack notifikation sendt');

    await sql`
      INSERT INTO agent_logs (id, agent_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'se-prospecting', 'Lead-søgning afsluttet',
        ${`Fandt ${leads.length} leads, indsatte ${inserted} nye`}, 'success', ${now})
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
