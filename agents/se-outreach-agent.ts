import Anthropic from '@anthropic-ai/sdk';
import { sql } from '../lib/db';
import { postMessage, postError } from '../lib/slack';
import { sendEmail, textToHtml } from '../lib/email';
import { randomUUID } from 'crypto';

export const schedule = '0 9 * * 1'; // Mandage kl. 9 (efter prospecting)

export const systemPrompt = `Du er outreach-agent for BusyConsultings svenske marked.
Du skriver ALTID på professionel, naturlig svenska. Aldrig dansk eller engelsk.

BusyConsultings produkter:
- AI Receptionist: AI der tager telefonen automatisk 24/7 — aldrig et mistet opkald
- BusyReminder: Automatiske SMS/email-påmindelser til kunder

Tone: Direkte, varm, kortfattet. Præsenter PROBLEMET — ikke produktet.
Max 4 sætninger i kroppen. Aldrig sælgende. Aldrig nævn pris.
Slutt ALTID med en konkret, enkel fråga.

Du får lead-info og returnerer præcis dette JSON:
{
  "subject": "Emnefeldt på svenska — max 8 ord, referera til company",
  "message": "Email-tekst på svenska — plain text, 4 sætninger + afsluttende spørgsmål"
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

    // Kun leads der har email og ikke er kontaktede endnu
    const leads = await sql`
      SELECT * FROM leads
      WHERE status = 'new'
        AND market = 'sweden'
        AND email IS NOT NULL
        AND email != ''
      LIMIT 20
    `;

    actions.push(`Fandt ${leads.length} leads til outreach`);

    if (leads.length === 0) {
      return { success: true, actions, data: { sent: 0 } };
    }

    const anthropic = process.env.ANTHROPIC_API_KEY
      ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      : null;

    const fromEmail = process.env.OUTREACH_FROM_EMAIL || 'BusyConsulting Sverige <sverige@busyconsulting.dk>';
    const now = new Date();
    let sent = 0;
    const errors: string[] = [];

    for (const lead of leads as unknown as Array<Record<string, string>>) {
      try {
        const firstName = lead.contact_name?.split(' ')[0] || 'där';

        // Fallback besked hvis ingen API-nøgle
        let subject = `${lead.company} – missade samtal kostar pengar`;
        let message = `Hej ${firstName}!\n\nJag märkte att ${lead.company} jobbar med ${lead.contact_title?.toLowerCase() || 'er verksamhet'}. Vet att det är svårt att hinna svara på alla samtal när man är ute på jobbet.\n\nVi hjälper verksamheter som er att aldrig missa ett kundsamtal igen — med AI som tar hand om telefonen automatiskt.\n\nPassar det med ett kort 15-minuterssamtal den här veckan?\n\nMed vänliga hälsningar,\nBusyConsulting Sverige`;

        if (anthropic) {
          const resp = await anthropic.messages.create({
            model: 'claude-opus-4-5',
            max_tokens: 400,
            system: systemPrompt,
            messages: [{
              role: 'user',
              content: `Lead: ${lead.company} (${lead.company_size}), kontakt: ${lead.contact_name} (${lead.contact_title}). Begrundelse: ${lead.why_they_fit}`,
            }],
          });
          const text = (resp.content[0] as { text: string }).text;
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            subject = parsed.subject || subject;
            message = parsed.message || message;
          }
        }

        // Send faktisk email via Resend
        await sendEmail({
          to: lead.email,
          subject,
          html: textToHtml(message),
          text: message,
          from: fromEmail,
          replyTo: fromEmail,
        });

        // Gem i outreach_sequences
        await sql`
          INSERT INTO outreach_sequences (id, lead_id, step, channel, subject, message, status, sent_at, created_at)
          VALUES (${randomUUID()}, ${lead.id}, 1, 'email', ${subject}, ${message}, 'sent', ${now.toISOString()}, ${now.toISOString()})
        `;

        // Opdater lead-status
        await sql`UPDATE leads SET status = 'contacted', updated_at = ${now.toISOString()} WHERE id = ${lead.id}`;

        sent++;
        console.log(`[SE Outreach] ✅ Email sendt til ${lead.company} (${lead.email})`);
      } catch (e) {
        const errMsg = String(e);
        errors.push(`${lead.company}: ${errMsg}`);
        console.error(`[SE Outreach] ❌ Fejl for ${lead.company}:`, e);
      }
    }

    actions.push(`${sent} outreach emails sendt`);
    if (errors.length > 0) actions.push(`${errors.length} fejl`);

    await postMessage('agent-salg-sverige', `🇸🇪 Outreach agent: ${sent} emails sendt til nye svenske leads${errors.length > 0 ? ` (${errors.length} fejl)` : ''}`);

    await sql`
      INSERT INTO agent_logs (id, agent_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'se-outreach', 'Outreach batch afsluttet',
        ${`Sendte ${sent}/${leads.length} emails. ${errors.length > 0 ? 'Fejl: ' + errors.slice(0, 3).join('; ') : ''}`},
        'success', ${now.toISOString()})
    `;

    return { success: true, actions, data: { total: leads.length, sent, errors } };
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
