import Anthropic from '@anthropic-ai/sdk';
import { sql } from '../lib/db';
import { postMeetingBooked, postError } from '../lib/slack';
import { sendEmail, textToHtml } from '../lib/email';
import { randomUUID } from 'crypto';

export const schedule = '0 9 * * *'; // Dagligt kl. 9

export const systemPrompt = `Du er booking-agent for BusyConsultings svenske marked.
Du skriver ALTID på professionel, naturlig svenska mod leads.

Når et lead er interesseret, send en booking email med:
1. Varm taksigelse for interessen
2. Forslag om 20-minutters demo-møde
3. Et Calendly-link til at booke tid
4. Kort agenda

Returner præcis dette JSON:
{
  "subject": "Emnefeldt på svenska — bekräftelse + company name",
  "message": "Email-tekst på svenska — inkluder [CALENDLY_URL] som placeholder til Calendly-linket"
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
      SELECT * FROM leads
      WHERE status = 'interested'
        AND market = 'sweden'
        AND email IS NOT NULL
    `;

    actions.push(`${leads.length} interesserede leads fundet`);

    if (leads.length === 0) {
      return { success: true, actions, data: { booked: 0 } };
    }

    const anthropic = process.env.ANTHROPIC_API_KEY
      ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      : null;

    const fromEmail = process.env.OUTREACH_FROM_EMAIL || 'BusyConsulting Sverige <sverige@busyconsulting.dk>';
    const calendlyUrl = process.env.CALENDLY_URL || 'https://calendly.com/busyconsulting/demo';
    const now = new Date();
    let booked = 0;

    for (const lead of leads as unknown as Array<Record<string, string>>) {
      try {
        const firstName = lead.contact_name?.split(' ')[0] || 'där';

        let subject = `Bekräftelse – demo med ${lead.company} och BusyConsulting`;
        let message = `Hej ${firstName}!\n\nTack för ditt intresse! Det känns kul att ni vill se mer.\n\nJag skulle gärna boka in ett kort 20-minuterssamtal där vi visar hur AI-receptionist kan fungera för ${lead.company}.\n\nBoka en tid som passar er här:\n${calendlyUrl}\n\nAgenda:\n- Intro BusyConsulting (3 min)\n- Er situation med inkommande samtal (7 min)\n- Live demo AI Receptionist (7 min)\n- Nästa steg (3 min)\n\nSer fram emot att ses!\n\nMed vänliga hälsningar,\nBusyConsulting Sverige`;

        if (anthropic) {
          const resp = await anthropic.messages.create({
            model: 'claude-opus-4-5',
            max_tokens: 500,
            system: systemPrompt,
            messages: [{
              role: 'user',
              content: `Lead: ${lead.company} (${lead.company_size}), ${lead.contact_name} (${lead.contact_title}). ${lead.why_they_fit}`,
            }],
          });
          const text = (resp.content[0] as { text: string }).text;
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            subject = parsed.subject || subject;
            // Erstat placeholder med faktisk Calendly-URL
            message = (parsed.message || message).replace('[CALENDLY_URL]', calendlyUrl);
          }
        }

        // Send booking email
        await sendEmail({
          to: lead.email,
          subject,
          html: textToHtml(message),
          text: message,
          from: fromEmail,
          replyTo: fromEmail,
        });

        // Gem møde i database
        const scheduledAt = new Date(now.getTime() + 3 * 24 * 3600000).toISOString();
        await sql`
          INSERT INTO meetings (id, lead_id, title, scheduled_at, duration_minutes, status, notes, created_at)
          VALUES (
            ${randomUUID()}, ${lead.id},
            ${'Demo møde – ' + lead.company},
            ${scheduledAt}, 20, 'scheduled',
            ${`Calendly link sendt til ${lead.email}. Afventer bekræftelse.`},
            ${now.toISOString()}
          )
        `;

        // Opdater lead-status til 'booked'
        await sql`UPDATE leads SET status = 'booked', updated_at = ${now.toISOString()} WHERE id = ${lead.id}`;

        // Gem i outreach sequence
        await sql`
          INSERT INTO outreach_sequences (id, lead_id, step, channel, subject, message, status, sent_at, created_at)
          VALUES (${randomUUID()}, ${lead.id}, 5, 'email', ${subject}, ${message}, 'sent', ${now.toISOString()}, ${now.toISOString()})
        `;

        await postMeetingBooked(
          { company: lead.company, contact_name: lead.contact_name },
          { scheduled_at: scheduledAt }
        );

        booked++;
        console.log(`[SE Booking] ✅ Booking email sendt til ${lead.company} (${lead.email})`);
      } catch (e) {
        console.error(`[SE Booking] ❌ Fejl for ${lead.company}:`, e);
      }
    }

    actions.push(`${booked} booking emails sendt`);

    await sql`
      INSERT INTO agent_logs (id, agent_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'se-booking', 'Booking batch afsluttet',
        ${`${booked} booking emails sendt af ${leads.length} interesserede leads`},
        'success', ${now.toISOString()})
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
