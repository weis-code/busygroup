/**
 * SE IMAP Agent
 * Læser indbakken, matcher svar fra svenske leads, analyserer sentiment med Claude,
 * og opdaterer lead-status automatisk.
 *
 * Kræver env vars:
 *   IMAP_HOST       — f.eks. mail.busyconsulting.dk
 *   IMAP_PORT       — 993 (SSL) eller 143
 *   IMAP_USER       — din email (f.eks. sverige@busyconsulting.dk)
 *   IMAP_PASS       — password
 *   ANTHROPIC_API_KEY
 */

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import Anthropic from '@anthropic-ai/sdk';
import { sql } from '../lib/db';
import { postMessage, postError } from '../lib/slack';
import { randomUUID } from 'crypto';

export const schedule = '0 * * * *'; // Hver time

const SENTIMENT_PROMPT = `Du er en salgsassistent. Analyser denne email-svar fra et potentielt lead.

Returner KUN dette JSON (ingen anden tekst):
{
  "sentiment": "positive" | "negative" | "neutral" | "unsubscribe",
  "reason": "Kort forklaring på dansk (max 1 sætning)",
  "action": "mark_interested" | "mark_lost" | "continue_sequence" | "stop_sequence"
}

Definitioner:
- positive: Viser interesse, ønsker møde, stiller positive spørgsmål → mark_interested
- negative: Ikke interesseret, har allerede løsning → mark_lost
- unsubscribe: Beder eksplicit om at stoppe kontakt, "nej tak", opt-out → stop_sequence + mark_lost
- neutral: Stiller spørgsmål, vil vide mere men er ikke klar endnu → continue_sequence`;

export interface AgentResult {
  success: boolean;
  actions: string[];
  data?: unknown;
  error?: string;
}

interface EmailAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral' | 'unsubscribe';
  reason: string;
  action: 'mark_interested' | 'mark_lost' | 'continue_sequence' | 'stop_sequence';
}

async function analyzeSentiment(emailText: string, anthropic: Anthropic): Promise<EmailAnalysis | null> {
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      system: SENTIMENT_PROMPT,
      messages: [{
        role: 'user',
        content: `Email-svar:\n\n${emailText.slice(0, 1000)}`, // Max 1000 tegn
      }],
    });
    const text = (resp.content[0] as { text: string }).text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]) as EmailAnalysis;
  } catch (e) {
    console.error('[SE IMAP] Sentiment analyse fejl:', e);
  }
  return null;
}

export async function run(): Promise<AgentResult> {
  const actions: string[] = [];

  // Tjek at IMAP-kreds er sat
  if (!process.env.IMAP_HOST || !process.env.IMAP_USER || !process.env.IMAP_PASS) {
    return {
      success: false,
      actions: ['IMAP_HOST, IMAP_USER eller IMAP_PASS mangler — springer over'],
      error: 'IMAP credentials mangler',
    };
  }

  const client = new ImapFlow({
    host: process.env.IMAP_HOST,
    port: Number(process.env.IMAP_PORT || 993),
    secure: process.env.IMAP_PORT !== '143',
    auth: {
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASS,
    },
    logger: false,
  });

  try {
    console.log('[SE IMAP] Forbinder til indbakke...');
    await client.connect();

    const lock = await client.getMailboxLock('INBOX');
    let processed = 0;
    let matched = 0;

    try {
      // Hent ulæste emails fra de seneste 14 dage
      const since = new Date();
      since.setDate(since.getDate() - 14);

      const messages = client.fetch(
        { since, seen: false },
        { envelope: true, bodyParts: ['TEXT'] }
      );

      // Hent alle svenske leads der er kontaktede
      const contactedLeads = await sql`
        SELECT id, company, contact_name, email, status
        FROM leads
        WHERE market = 'sweden'
          AND email IS NOT NULL
          AND status IN ('contacted', 'replied')
      `;

      const leadByEmail = new Map(
        (contactedLeads as Array<{ id: string; company: string; contact_name: string; email: string; status: string }>)
          .map(l => [l.email.toLowerCase().trim(), l])
      );

      const anthropic = process.env.ANTHROPIC_API_KEY
        ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        : null;

      const now = new Date().toISOString();

      for await (const msg of messages) {
        processed++;

        // Find afsenderens email
        const fromAddress = msg.envelope?.from?.[0];
        if (!fromAddress?.address) continue;

        const senderEmail = fromAddress.address.toLowerCase().trim();
        const lead = leadByEmail.get(senderEmail);

        if (!lead) continue; // Ikke et lead vi kender

        matched++;
        console.log(`[SE IMAP] ✉️ Svar fra lead: ${lead.company} (${senderEmail})`);

        // Parse email-tekst
        let emailText = '';
        try {
          const rawBody = msg.bodyParts?.get('TEXT');
          if (rawBody) {
            const parsed = await simpleParser(Buffer.from(rawBody as unknown as string));
            emailText = parsed.text || '';
          }
        } catch {
          emailText = '(Kunne ikke parse email-tekst)';
        }

        // Analyser sentiment
        let analysis: EmailAnalysis | null = null;
        if (anthropic && emailText) {
          analysis = await analyzeSentiment(emailText, anthropic);
        }

        const sentiment = analysis?.sentiment || 'neutral';
        const reason = analysis?.reason || 'Ukendt sentiment';
        const action = analysis?.action || 'continue_sequence';

        console.log(`[SE IMAP] Sentiment: ${sentiment} — ${reason}`);

        // Opdater lead baseret på analyse
        if (action === 'mark_interested' && lead.status !== 'interested') {
          await sql`UPDATE leads SET status = 'interested', updated_at = ${now} WHERE id = ${lead.id}`;
          actions.push(`${lead.company}: markeret som interesseret`);

          // Stop aktive sequences for dette lead
          await sql`UPDATE outreach_sequences SET status = 'replied' WHERE lead_id = ${lead.id} AND status = 'sent'`;

          await postMessage('agent-salg-sverige',
            `🇸🇪 ✅ *${lead.company}* svarede POSITIVT! Booking agent sender møde-invitation. _"${reason}"_`
          );

        } else if (action === 'mark_lost' || action === 'stop_sequence') {
          await sql`UPDATE leads SET status = 'lost', updated_at = ${now} WHERE id = ${lead.id}`;
          await sql`UPDATE outreach_sequences SET status = 'stopped' WHERE lead_id = ${lead.id} AND status = 'sent'`;
          actions.push(`${lead.company}: markeret som tabt (${reason})`);

          await postMessage('agent-salg-sverige',
            `🇸🇪 ❌ *${lead.company}* ønsker ikke kontakt. Sekvens stoppet. _"${reason}"_`
          );

        } else if (action === 'continue_sequence') {
          await sql`UPDATE leads SET status = 'replied', updated_at = ${now} WHERE id = ${lead.id}`;
          actions.push(`${lead.company}: svaret (neutral) — fortsætter sekvens`);
        }

        // Log svar i agent_logs
        await sql`
          INSERT INTO agent_logs (id, agent_id, lead_id, action, details, result, created_at)
          VALUES (
            ${randomUUID()}, 'se-imap', ${lead.id},
            'Svar registreret',
            ${`Fra: ${senderEmail}. Sentiment: ${sentiment}. ${reason}`},
            ${sentiment === 'positive' ? 'success' : 'info'},
            ${now}
          )
        `;

        // Marker email som læst
        await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen']);
      }

    } finally {
      lock.release();
    }

    await client.logout();

    actions.push(`Tjekkede ${processed} emails, matchede ${matched} lead-svar`);

    if (matched > 0) {
      await sql`
        INSERT INTO agent_logs (id, agent_id, action, details, result, created_at)
        VALUES (${randomUUID()}, 'se-imap', 'IMAP-tjek afsluttet',
          ${`${processed} emails gennemgået, ${matched} lead-svar behandlet`},
          'success', ${new Date().toISOString()})
      `;
    }

    console.log(`[SE IMAP] ✅ Afsluttet — ${processed} emails, ${matched} leads matchet`);
    return { success: true, actions, data: { processed, matched } };

  } catch (err) {
    const error = String(err);
    try { await client.logout(); } catch { /* ignore */ }
    await postError('SE IMAP', error);
    console.error('[SE IMAP] Fejl:', err);
    await sql`
      INSERT INTO agent_logs (id, agent_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'se-imap', 'IMAP fejl', ${error}, 'error', ${new Date().toISOString()})
    `;
    return { success: false, actions, error };
  }
}
