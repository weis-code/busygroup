/**
 * SE IMAP Agent
 * Poller ALLE aktive IMAP-konti fra databasen, matcher svar fra svenske leads,
 * gemmer alle emails i messages-tabellen, og analyserer sentiment med Claude.
 */

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import Anthropic from '@anthropic-ai/sdk';
import { sql } from '../lib/db';
import { postMessage, postError } from '../lib/slack';
import { randomUUID } from 'crypto';

export const schedule = '*/10 * * * *'; // Hvert 10. minut

const SENTIMENT_PROMPT = `Du er en salgsassistent. Analyser dette email-svar fra et potentielt lead.

Returner KUN dette JSON (ingen anden tekst):
{
  "sentiment": "positive" | "negative" | "neutral" | "unsubscribe",
  "reason": "Kort forklaring på dansk (max 1 sætning)",
  "action": "mark_interested" | "mark_lost" | "continue_sequence" | "stop_sequence"
}

- positive: Viser interesse, ønsker møde → mark_interested
- negative: Ikke interesseret, har allerede løsning → mark_lost
- unsubscribe: Beder om at stoppe kontakt → stop_sequence
- neutral: Stiller spørgsmål, vil vide mere → continue_sequence`;

export interface AgentResult {
  success: boolean;
  actions: string[];
  data?: unknown;
  error?: string;
}

async function syncAccount(
  account: { id: string; email: string; host: string; port: number; tls: boolean; username: string; password: string; name: string },
  leadByEmail: Map<string, { id: string; company: string; email: string; status: string }>,
  anthropic: Anthropic | null,
  actions: string[]
): Promise<{ processed: number; matched: number }> {
  const client = new ImapFlow({
    host: account.host,
    port: account.port,
    secure: account.tls,
    auth: { user: account.username, pass: account.password },
    logger: false,
  });

  let processed = 0;
  let matched = 0;
  const now = new Date().toISOString();

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      const since = new Date();
      since.setDate(since.getDate() - 30); // De seneste 30 dage

      // Hent alle beskeder (ikke kun unseen) — deduplicering sker på imap_uid
      const messages = client.fetch({ since }, { envelope: true, source: true });

      for await (const msg of messages) {
        processed++;

        const fromAddress = msg.envelope?.from?.[0];
        if (!fromAddress?.address) continue;

        const senderEmail = fromAddress.address.toLowerCase().trim();
        const senderName = fromAddress.name || null;
        const subject = msg.envelope?.subject || null;
        const receivedAt = msg.envelope?.date?.toISOString() || now;

        // Parse body fra source
        let bodyText = '';
        try {
          if (msg.source) {
            const parsed = await simpleParser(msg.source as Buffer);
            bodyText = parsed.text || '';
          }
        } catch { bodyText = ''; }

        // Tjek om vi allerede har denne besked (dedupliker på uid + account)
        const [existing] = await sql`
          SELECT id FROM messages WHERE imap_account_id = ${account.id} AND imap_uid = ${msg.uid}
        `;
        if (existing) continue;

        // Match til lead eller kunde
        const lead = leadByEmail.get(senderEmail);
        const [customer] = await sql`SELECT id FROM customers WHERE LOWER(contact_email) = ${senderEmail} LIMIT 1`;

        // Gem besked i messages-tabellen
        await sql`
          INSERT INTO messages (
            id, imap_account_id, imap_uid, direction, from_email, from_name,
            to_email, subject, body_text, lead_id, customer_id, read, received_at, created_at
          ) VALUES (
            ${randomUUID()}, ${account.id}, ${msg.uid}, 'inbound',
            ${senderEmail}, ${senderName},
            ${account.email}, ${subject}, ${bodyText},
            ${lead?.id || null}, ${customer?.id || null},
            false, ${receivedAt}, ${now}
          )
        `;

        // Hvis det er et lead-svar → sentiment-analyse
        if (lead && ['contacted', 'replied'].includes(lead.status)) {
          matched++;
          console.log(`[SE IMAP] ✉️ Svar fra lead: ${lead.company} (${senderEmail})`);

          let sentiment = 'neutral';
          let reason = 'Svar modtaget';
          let action = 'continue_sequence';

          if (anthropic && bodyText) {
            try {
              const resp = await anthropic.messages.create({
                model: 'claude-haiku-4-5',
                max_tokens: 200,
                system: SENTIMENT_PROMPT,
                messages: [{ role: 'user', content: `Email:\n\n${bodyText.slice(0, 1000)}` }],
              });
              const text = (resp.content[0] as { text: string }).text;
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                sentiment = parsed.sentiment || sentiment;
                reason = parsed.reason || reason;
                action = parsed.action || action;
              }
            } catch { /* brug fallback */ }
          }

          // Opdater lead
          if (action === 'mark_interested') {
            await sql`UPDATE leads SET status = 'interested', updated_at = ${now} WHERE id = ${lead.id}`;
            await sql`UPDATE outreach_sequences SET status = 'replied' WHERE lead_id = ${lead.id} AND status = 'sent'`;
            actions.push(`${lead.company}: interesseret ✅`);
            await postMessage('agent-salg-sverige', `🇸🇪 ✅ *${lead.company}* svarede POSITIVT! _"${reason}"_`);
          } else if (action === 'mark_lost' || action === 'stop_sequence') {
            await sql`UPDATE leads SET status = 'lost', updated_at = ${now} WHERE id = ${lead.id}`;
            await sql`UPDATE outreach_sequences SET status = 'stopped' WHERE lead_id = ${lead.id} AND status = 'sent'`;
            actions.push(`${lead.company}: tabt — ${reason}`);
          } else {
            await sql`UPDATE leads SET status = 'replied', updated_at = ${now} WHERE id = ${lead.id}`;
            actions.push(`${lead.company}: svaret (neutral)`);
          }

          await sql`
            INSERT INTO agent_logs (id, agent_id, lead_id, action, details, result, created_at)
            VALUES (${randomUUID()}, 'se-imap', ${lead.id}, 'Svar registreret',
              ${`Fra: ${senderEmail}. Sentiment: ${sentiment}. ${reason}`},
              ${sentiment === 'positive' ? 'success' : 'info'}, ${now})
          `;
        }

        // Marker email som læst i IMAP
        await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen']);
      }
    } finally {
      lock.release();
    }

    // Opdater last_sync
    await sql`UPDATE imap_accounts SET last_sync = ${now} WHERE id = ${account.id}`;
    await client.logout();
  } catch (e) {
    try { await client.logout(); } catch { /* ignore */ }
    throw e;
  }

  return { processed, matched };
}

export async function run(): Promise<AgentResult> {
  const actions: string[] = [];

  // Hent alle aktive IMAP-konti fra DB
  const accounts = await sql`SELECT * FROM imap_accounts WHERE active = true`;

  if (accounts.length === 0) {
    // Fallback: tjek env vars for bagud-kompatibilitet
    if (!process.env.IMAP_HOST || !process.env.IMAP_USER || !process.env.IMAP_PASS) {
      return {
        success: false,
        actions: ['Ingen aktive IMAP-konti — tilføj dem i Indstillinger'],
        error: 'Ingen IMAP-konti konfigureret',
      };
    }

    // Brug env vars som fallback
    actions.push('Bruger IMAP fra env vars (legacy)');
    (accounts as unknown as Array<Record<string, unknown>>).push({
      id: 'env-fallback',
      name: 'Env vars konto',
      email: process.env.IMAP_USER,
      host: process.env.IMAP_HOST,
      port: Number(process.env.IMAP_PORT || 993),
      tls: process.env.IMAP_PORT !== '143',
      username: process.env.IMAP_USER,
      password: process.env.IMAP_PASS,
    });
  }

  const anthropic = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;

  // Hent alle kontaktede svenske leads én gang
  const contactedLeads = await sql`
    SELECT id, company, email, status FROM leads
    WHERE market = 'sweden' AND email IS NOT NULL AND status IN ('contacted', 'replied')
  `;
  const leadByEmail = new Map(
    (contactedLeads as unknown as Array<{ id: string; company: string; email: string; status: string }>)
      .map(l => [l.email.toLowerCase().trim(), l])
  );

  let totalProcessed = 0;
  let totalMatched = 0;
  const errors: string[] = [];

  for (const account of accounts as unknown as Array<{ id: string; email: string; host: string; port: number; tls: boolean; username: string; password: string; name: string }>) {
    try {
      console.log(`[SE IMAP] Synkroniserer ${account.name} (${account.email})...`);
      const { processed, matched } = await syncAccount(account, leadByEmail, anthropic, actions);
      totalProcessed += processed;
      totalMatched += matched;
      actions.push(`${account.name}: ${processed} emails, ${matched} lead-svar`);
    } catch (e) {
      const err = `${account.name}: ${String(e)}`;
      errors.push(err);
      console.error(`[SE IMAP] Fejl på ${account.name}:`, e);
    }
  }

  if (errors.length > 0) {
    await postError('SE IMAP', errors.join('\n'));
  }

  console.log(`[SE IMAP] ✅ ${accounts.length} konti, ${totalProcessed} emails, ${totalMatched} matches`);
  await sql`
    INSERT INTO agent_logs (id, agent_id, action, details, result, created_at)
    VALUES (${randomUUID()}, 'se-imap', 'IMAP sync afsluttet',
      ${`${accounts.length} konti, ${totalProcessed} emails gennemgået, ${totalMatched} lead-svar behandlet`},
      ${errors.length > 0 ? 'error' : 'success'}, ${new Date().toISOString()})
  `;

  return {
    success: errors.length === 0,
    actions,
    data: { accounts: accounts.length, processed: totalProcessed, matched: totalMatched, errors },
  };
}
