import Anthropic from '@anthropic-ai/sdk';
import { sql } from '../lib/db';
import { randomUUID } from 'crypto';

export const schedule = '0 6 * * 1-5';

export const systemPrompt = `Du er call-prep agent for BusyConsultings danske salgsteam.
Du forbereder ALTID materialet på dansk.

Du modtager info om et lead og returnerer præcis dette JSON – intet andet:
{
  "call": {
    "opening": "Åbningssætning til sælgeren – konkret, ikke generisk",
    "pain_points": ["smertepunkt 1", "smertepunkt 2", "smertepunkt 3"],
    "key_questions": ["spørgsmål 1", "spørgsmål 2", "spørgsmål 3"],
    "objections": [
      { "objection": "Har ikke tid nu", "response": "svar" },
      { "objection": "Bruger en konkurrent", "response": "svar" },
      { "objection": "Send noget på mail", "response": "svar" }
    ],
    "goal": "Konkret mål for opkaldet – hvad skal sælgeren opnå?"
  },
  "email": {
    "subject": "Emnelinjen – under 60 tegn, nysgerrighedsskabende",
    "body": "E-mailbrødteksten – max 120 ord, personlig, ikke sælgende. Nævn aldrig pris."
  }
}

Regler:
- Brug altid konkrete detaljer fra lead-profilen
- Åbningssætningen: 1-2 sætninger – præsenter et problem, ikke et produkt
- Smertepunkter: branchespecifikke, ikke generiske
- Spørgsmål: åbne, kortlægggende – ikke lukkede ja/nej spørgsmål
- Mål for opkaldet: enten book møde, afdæk timing, eller få e-mail-tilladelse
- Tonen er professionel og menneskelig`;

export interface AgentResult {
  success: boolean;
  actions: string[];
  data?: unknown;
  error?: string;
}

export async function runForLead(leadId: string): Promise<AgentResult> {
  const actions: string[] = [];

  try {
    const [lead] = await sql`SELECT * FROM leads WHERE id = ${leadId}`;
    if (!lead) throw new Error(`Lead ${leadId} ikke fundet`);

    // Get call log history for context
    const history = await sql`
      SELECT action, details, created_at FROM agent_logs WHERE lead_id = ${leadId} ORDER BY created_at DESC LIMIT 5
    `;
    const notes = await sql`
      SELECT content, created_at FROM notes WHERE lead_id = ${leadId} ORDER BY created_at DESC LIMIT 3
    `;

    const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
    const now = new Date().toISOString();

    let content: Record<string, unknown>;

    if (anthropic) {
      const resp = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Lead: ${lead.company}
Kontakt: ${lead.contact_name} (${lead.contact_title})
Status: ${lead.status}
Marked: ${lead.market}
Størrelse: ${lead.company_size || 'ukendt'}
Hvorfor de passer: ${lead.why_they_fit || 'Ikke angivet'}
Prioritet: ${lead.priority}

Historik:
${(history as unknown as Array<{ action: string; details: string }>).map(h => `- ${h.action}: ${h.details}`).join('\n') || 'Ingen historik endnu'}

Seneste noter:
${(notes as unknown as Array<{ content: string }>).map(n => `- ${n.content}`).join('\n') || 'Ingen noter'}`,
        }],
      });
      const text = (resp.content[0] as { text: string }).text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Claude returnerede ikke valid JSON');
      content = JSON.parse(jsonMatch[0]);
    } else {
      // Fallback mock
      content = {
        call: {
          opening: `Hej ${String(lead.contact_name).split(' ')[0]}, jeg ringer fordi vi hjælper ${lead.company} med at håndtere opkald automatisk – I mister sikkert kunder på ubesvarede opkald?`,
          pain_points: ['Ubesvarede opkald koster omsætning', 'Receptionist er dyr og skalerer ikke', 'Kunder vælger konkurrenten der svarer hurtigere'],
          key_questions: ['Hvor mange opkald besvarer I ikke om dagen?', 'Hvad sker der med en kunde der ikke kan komme igennem?', 'Hvad ville det betyde for jer at aldrig miste et opkald igen?'],
          objections: [
            { objection: 'Har ikke tid nu', response: 'Jeg forstår – det tager kun 15 min. Hvornår passer det bedre?' },
            { objection: 'Bruger en konkurrent', response: 'Interessant – hvad løser I ikke med dem i dag?' },
            { objection: 'Send noget på mail', response: 'Selvfølgelig – og kan vi aftale et opfølgningsopkald oven på det?' },
          ],
          goal: 'Book et 20-minutters demo-møde',
        },
        email: {
          subject: `${String(lead.contact_name).split(' ')[0]} – om ubesvarede opkald hos ${lead.company}`,
          body: `Hej ${String(lead.contact_name).split(' ')[0]},\n\nJeg ringede kort. Vi hjælper virksomheder som ${lead.company} med at sikre, at ingen opkald falder igennem – hverken i travle perioder eller efter lukketid.\n\nKan vi tage 15 minutter til at se om det giver mening for jer?\n\nMed venlig hilsen\n[Dit navn]\nBusyConsulting`,
        },
      };
    }

    // Save brief to DB
    await sql`
      INSERT INTO briefs (id, lead_id, type, content, created_at, created_by)
      VALUES (${randomUUID()}, ${leadId}, 'call', ${JSON.stringify(content)}, ${now}, 'dk-callprep-agent')
    `;

    // Update lead flags
    await sql`UPDATE leads SET brief_ready = 1, brief_updated_at = ${now}, updated_at = ${now} WHERE id = ${leadId}`;

    // Log it
    await sql`
      INSERT INTO agent_logs (id, agent_id, lead_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'dk-callprep', ${leadId}, 'Brief forberedt', ${`Call brief + email brief klar til ${lead.company}`}, 'success', ${now})
    `;

    actions.push(`Brief forberedt til ${lead.company}`);
    return { success: true, actions, data: content };
  } catch (err) {
    const error = String(err);
    await sql`
      INSERT INTO agent_logs (id, agent_id, lead_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'dk-callprep', ${leadId}, 'Fejl ved brief', ${error}, 'error', ${new Date().toISOString()})
    `;
    return { success: false, actions, error };
  }
}

export async function run(): Promise<AgentResult> {
  const actions: string[] = [];

  try {
    // Find all DK leads that need a fresh brief
    const leads = await sql`
      SELECT * FROM leads
      WHERE market = 'denmark'
        AND status NOT IN ('won', 'lost')
        AND (brief_ready = 0 OR brief_updated_at < NOW() - INTERVAL '3 days')
      LIMIT 20
    `;

    actions.push(`Fandt ${leads.length} DK leads til brief-forberedelse`);
    let prepared = 0;

    for (const lead of leads as unknown as Array<{ id: string; company: string }>) {
      const result = await runForLead(lead.id);
      if (result.success) prepared++;
    }

    actions.push(`${prepared} briefs forberedt`);
    return { success: true, actions, data: { total: leads.length, prepared } };
  } catch (err) {
    const error = String(err);
    await sql`
      INSERT INTO agent_logs (id, agent_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'dk-callprep', 'Fejl under batch-kørsel', ${error}, 'error', ${new Date().toISOString()})
    `;
    return { success: false, actions, error };
  }
}
