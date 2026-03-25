import Anthropic from '@anthropic-ai/sdk';
import { sql } from '../lib/db';
import { postMeetingBooked, postError } from '../lib/slack';
import { randomUUID } from 'crypto';

export const schedule = '0 9 * * *';

export const systemPrompt = `Du er booking-agent for BusyConsultings svenske marked.
Mod leads: skriv på svensk.
Mod salgsteamet: skriv på dansk.

Når et lead er interesseret:
1. Foreslå 3 mødetider (næste 5 hverdage, 09-16)
2. Skriv en kort bookingbesked
3. Forbered mødeagenda

Returner præcis dette JSON:
{
  "booking_message": "besked på svensk",
  "meeting_times": ["Man 24. mar 10:00", "Tir 25. mar 14:00", "Ons 26. mar 11:00"],
  "agenda": [
    "Intro BusyConsulting (5 min)",
    "Jeres situation med opkald (10 min)",
    "Demo AI Receptionist (10 min)",
    "Næste skridt (5 min)"
  ]
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
    console.log('[SE Booking] Starter booking-tjek...');

    const leads = await sql`
      SELECT * FROM leads WHERE status = 'interested' AND market = 'sweden'
    `;

    actions.push(`${leads.length} interesserede leads fundet`);

    const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
    const now = new Date();
    let booked = 0;

    for (const lead of leads as Array<Record<string, string>>) {
      try {
        let bookingData = {
          booking_message: `Hej ${lead.contact_name?.split(' ')[0]}! Tack för ditt intresse. Kan vi boka ett kort möte denna vecka?`,
          meeting_times: ['Mån 10:00', 'Tis 14:00', 'Ons 11:00'],
          agenda: ['Intro BusyConsulting (5 min)', 'Er situation (10 min)', 'Demo AI Receptionist (10 min)', 'Nästa steg (5 min)'],
        };

        if (anthropic) {
          const resp = await anthropic.messages.create({
            model: 'claude-opus-4-6',
            max_tokens: 500,
            system: systemPrompt,
            messages: [{
              role: 'user',
              content: `Lead: ${lead.company}, ${lead.contact_name} (${lead.contact_title}). ${lead.why_they_fit}`
            }],
          });
          const text = (resp.content[0] as { text: string }).text;
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            bookingData = { ...bookingData, ...JSON.parse(jsonMatch[0]) };
          }
        }

        const scheduledAt = new Date(now.getTime() + 2 * 24 * 3600000).toISOString();

        await sql`
          INSERT INTO meetings (id, lead_id, title, scheduled_at, duration_minutes, status, created_at)
          VALUES (${randomUUID()}, ${lead.id}, ${'Demo møde – ' + lead.company}, ${scheduledAt}, 30, 'scheduled', ${now.toISOString()})
        `;

        await sql`UPDATE leads SET status = 'booked', updated_at = ${now.toISOString()} WHERE id = ${lead.id}`;

        await postMeetingBooked({ company: lead.company, contact_name: lead.contact_name }, { scheduled_at: scheduledAt });
        booked++;

        console.log(`[SE Booking] Møde booket for ${lead.company}`);
      } catch (e) {
        console.error(`[SE Booking] Fejl for ${lead.company}:`, e);
      }
    }

    actions.push(`${booked} møder booket`);

    await sql`
      INSERT INTO agent_logs (id, agent_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'se-booking', 'Booking batch afsluttet', ${`${booked} møder booket af ${leads.length} interesserede leads`}, 'success', ${now.toISOString()})
    `;

    return { success: true, actions, data: { booked, total: leads.length } };
  } catch (err) {
    const error = String(err);
    await postError('SE Booking', error);
    await sql`
      INSERT INTO agent_logs (id, agent_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'se-booking', 'Fejl under booking', ${error}, 'error', ${new Date().toISOString()})
    `;
    return { success: false, actions, error };
  }
}
