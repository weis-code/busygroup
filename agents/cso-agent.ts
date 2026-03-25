import Anthropic from '@anthropic-ai/sdk';
import { sql } from '../lib/db';
import { postWeeklyReport, postError } from '../lib/slack';
import { randomUUID } from 'crypto';

export const schedule = '0 7 * * 1';

export const systemPrompt = `Du er CSO (Chief Sales Officer) for BusyConsulting, en del af BusyGroup.
BusyConsulting sælger:
- AI Receptionist: 1.000 kr/md (klinikker + håndværkere)
- BusyReminder Basic: 149 kr/md
- BusyReminder Pro: 549 kr/md
- Hjemmesider: 750 kr/md

Din internationale afdeling (Sverige) kører fuldt automatisk. Din danske afdeling kører med menneske-i-loop.

Ansvar:
- Analysér pipeline og identificér flaskehalse
- Koordinér agenter mod ugentlige salgsmål
- Rapportér til CEO og COO i Slack hver mandag 07:00
- Eskaler beslutninger der kræver mennesker

Rapporter skal altid inkludere:
- Leads fundet / kontaktet / svaret / møder booket
- Conversion rates per stadie
- Hvad der blokerer pipeline
- Top 3 anbefalede næste skridt

Tone: Direkte, effektiv, ingen fluff.
Kommunikér altid på dansk med ledelsen.`;

export interface AgentResult {
  success: boolean;
  actions: string[];
  data?: unknown;
  error?: string;
}

export async function run(): Promise<AgentResult> {
  const actions: string[] = [];

  try {
    console.log('[CSO Agent] Starter ugentlig analyse...');

    const [stats] = await sql`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_leads,
        SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted,
        SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replied,
        SUM(CASE WHEN status = 'interested' THEN 1 ELSE 0 END) as interested,
        SUM(CASE WHEN status = 'booked' THEN 1 ELSE 0 END) as booked,
        SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won,
        SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lost
      FROM leads WHERE market = 'sweden'
    `;

    const [meetings] = await sql`
      SELECT COUNT(*) as count FROM meetings
      WHERE status = 'scheduled' AND scheduled_at >= NOW()
    `;

    actions.push('Pipeline stats hentet fra database');

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

    const prompt = `Pipeline status for denne uge (Sverige):
- Total leads: ${stats.total}
- Nye leads: ${stats.new_leads}
- Kontaktet: ${stats.contacted}
- Svar modtaget: ${stats.replied}
- Interesserede: ${stats.interested}
- Møder booket: ${stats.booked}
- Vundet: ${stats.won}
- Tabt: ${stats.lost}
- Kommende møder: ${meetings.count}

Skriv en struktureret mandagsrapport til CEO og COO. Inkluder conversion rates og top 3 anbefalinger.`;

    let reportText = '';
    if (process.env.ANTHROPIC_API_KEY) {
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });
      reportText = (response.content[0] as { text: string }).text;
      actions.push('Claude API rapport genereret');
    } else {
      reportText = `*Ugentlig Pipeline Rapport – Sverige*\nTotal: ${stats.total} leads | Kontaktet: ${stats.contacted} | Svar: ${stats.replied} | Møder: ${meetings.count}\nConversion: ${Number(stats.total) > 0 ? Math.round((Number(stats.won) / Number(stats.total)) * 100) : 0}%`;
      actions.push('Rapport genereret (mock – ingen API nøgle)');
    }

    await postWeeklyReport({
      leadsFound: Number(stats.new_leads),
      outreachSent: Number(stats.contacted),
      replies: Number(stats.replied),
      meetingsBooked: Number(stats.booked),
      conversionRate: `${Number(stats.total) > 0 ? Math.round(((Number(stats.interested) + Number(stats.booked) + Number(stats.won)) / Number(stats.total)) * 100) : 0}%`,
    });
    actions.push('Rapport sendt til Slack #busygroup-ledelse');

    await sql`
      INSERT INTO agent_logs (id, agent_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'cso', 'Ugentlig rapport genereret', ${reportText.substring(0, 500)}, 'success', ${new Date().toISOString()})
    `;

    return { success: true, actions, data: { stats, reportText } };
  } catch (err) {
    const error = String(err);
    await postError('CSO Agent', error);
    await sql`
      INSERT INTO agent_logs (id, agent_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'cso', 'Fejl under kørsel', ${error}, 'error', ${new Date().toISOString()})
    `;
    return { success: false, actions, error };
  }
}
