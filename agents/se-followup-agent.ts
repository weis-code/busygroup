import Anthropic from '@anthropic-ai/sdk';
import { sql } from '../lib/db';
import { postMessage, postError } from '../lib/slack';
import { sendEmail, textToHtml } from '../lib/email';
import { randomUUID } from 'crypto';

export const schedule = '30 8 * * *'; // Dagligt kl. 8:30

// Antal dage mellem hvert trin
const STEP_DELAYS = { 1: 5, 2: 10, 3: 15 }; // Trin 1→2: 5 dage, 2→3: 10 dage, 3→4: 15 dage

export const systemPrompt = `Du er follow-up agent for BusyConsultings svenske marked.
Du skriver ALTID på professionel, naturlig svenska.

Sekvens:
- Trin 2 (dag 5 efter første email): Ny vinkel, max 3 sætninger. Stilt et konkret spørgsmål.
- Trin 3 (dag 10): Referér til et konkret brancheeksempel. Max 4 sætninger.
- Trin 4 (dag 15): Break-up besked. Lad døren stå åben. Giv dem mulighed for at sige nej.

Du får lead-info + trin-nummer og returnerer:
{
  "subject": "Emnefeldt — brug 'Re:' på trin 2-3, ny emne på trin 4",
  "message": "Email-tekst på svenska — plain text"
}

Inkluder ALTID i bunden: "Om du inte vill ha fler mail, svarar du bara 'Nej tack' — då hör vi inte av oss igen."
Stop ALTID sekvensen efter trin 4.`;

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

    // Find alle SENDTE sekvenser der er klar til næste trin
    // "Klar" = sent_at er for N dage siden baseret på step
    const sequences = await sql`
      SELECT os.*, l.company, l.contact_name, l.contact_title, l.email, l.why_they_fit
      FROM outreach_sequences os
      JOIN leads l ON os.lead_id = l.id
      WHERE os.status = 'sent'
        AND l.status = 'contacted'
        AND l.market = 'sweden'
        AND l.email IS NOT NULL
        AND os.step < 4
        AND (
          (os.step = 1 AND os.sent_at <= NOW() - INTERVAL '5 days') OR
          (os.step = 2 AND os.sent_at <= NOW() - INTERVAL '5 days') OR
          (os.step = 3 AND os.sent_at <= NOW() - INTERVAL '5 days')
        )
    `;

    actions.push(`${sequences.length} follow-up opgaver fundet`);

    const anthropic = process.env.ANTHROPIC_API_KEY
      ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      : null;

    const fromEmail = process.env.OUTREACH_FROM_EMAIL || 'BusyConsulting Sverige <sverige@busyconsulting.dk>';
    const now = new Date();
    let processed = 0;
    let stopped = 0;

    for (const seq of sequences as Array<Record<string, string | number>>) {
      const nextStep = Number(seq.step) + 1;

      // Trin 4 er break-up — efter det stopper vi sekvensen
      if (nextStep > 4) {
        await sql`UPDATE outreach_sequences SET status = 'completed' WHERE id = ${seq.id}`;
        await sql`UPDATE leads SET status = 'lost', updated_at = ${now.toISOString()} WHERE id = ${seq.lead_id}`;
        stopped++;
        continue;
      }

      const firstName = String(seq.contact_name).split(' ')[0];

      // Fallback beskeder per trin
      const fallbacks: Record<number, { subject: string; message: string }> = {
        2: {
          subject: `Re: ${seq.company} – missade samtal`,
          message: `Hej ${firstName}!\n\nVille bara höra om ni har räknat på hur många samtal ni missar per vecka — och vad det kostar i förlorade uppdrag?\n\nMånga av våra kunder i branschen var förvånade när de såg siffrorna.\n\nOm du inte vill ha fler mail, svarar du bara "Nej tack" — då hör vi inte av oss igen.`,
        },
        3: {
          subject: `Re: ${seq.company} – konkret exempel`,
          message: `Hej ${firstName}!\n\nEn tandklinik i Stockholm vi arbetar med svarade tidigare på 60% av sina samtal. Efter att de satte upp vår AI-receptionist svarar de på 100% — och bokningarna ökade med 23% på tre månader.\n\nJag tror vi kan uppnå liknande resultat för ${seq.company}.\n\nPassar ett kort 15-minuterssamtal den här veckan?\n\nOm du inte vill ha fler mail, svarar du bara "Nej tack" — då hör vi inte av oss igen.`,
        },
        4: {
          subject: `Sista hälsningen från BusyConsulting`,
          message: `Hej ${firstName}!\n\nJag förstår att timingen kanske inte passar just nu. Det är helt okej.\n\nJag lägger er på is och hör inte av mig igen — men om ni någon gång vill titta på hur AI kan hjälpa ${seq.company} att aldrig missa ett samtal, är ni välkomna att höra av er.\n\nAllt gott,\nBusyConsulting Sverige`,
        },
      };

      let subject = fallbacks[nextStep]?.subject || `Re: ${seq.company}`;
      let message = fallbacks[nextStep]?.message || '';

      if (anthropic) {
        try {
          const resp = await anthropic.messages.create({
            model: 'claude-opus-4-5',
            max_tokens: 400,
            system: systemPrompt,
            messages: [{
              role: 'user',
              content: `Lead: ${seq.company}, ${seq.contact_name} (${seq.contact_title}). Trin: ${nextStep}. Baggrund: ${seq.why_they_fit}. Første email-emne: ${seq.subject || ''}`,
            }],
          });
          const text = (resp.content[0] as { text: string }).text;
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            subject = parsed.subject || subject;
            message = parsed.message || message;
          }
        } catch (e) {
          console.error('[SE Follow-up] Claude API fejl:', e);
        }
      }

      try {
        // Send follow-up email
        await sendEmail({
          to: String(seq.email),
          subject,
          html: textToHtml(message),
          text: message,
          from: fromEmail,
          replyTo: fromEmail,
        });

        // Gem ny sekvens-post for dette trin
        await sql`
          INSERT INTO outreach_sequences (id, lead_id, step, channel, subject, message, status, sent_at, created_at)
          VALUES (${randomUUID()}, ${seq.lead_id}, ${nextStep}, 'email', ${subject}, ${message}, 'sent', ${now.toISOString()}, ${now.toISOString()})
        `;

        // Marker det gamle trin som 'advanced'
        await sql`UPDATE outreach_sequences SET status = 'advanced' WHERE id = ${seq.id}`;

        processed++;
        console.log(`[SE Follow-up] ✅ Trin ${nextStep} sendt til ${seq.company}`);
      } catch (e) {
        console.error(`[SE Follow-up] ❌ Fejl for ${seq.company}:`, e);
      }
    }

    actions.push(`${processed} follow-up emails sendt, ${stopped} sekvenser afsluttet (mark som lost)`);
    await postMessage('agent-salg-sverige', `🇸🇪 Follow-up agent: ${processed} emails sendt, ${stopped} sekvenser lukket`);

    await sql`
      INSERT INTO agent_logs (id, agent_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'se-followup', 'Follow-up batch afsluttet',
        ${`${processed} sendt, ${stopped} stoppet af ${sequences.length} kandidater`},
        'success', ${now.toISOString()})
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
