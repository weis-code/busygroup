/**
 * POST /api/mail/sync
 * Synkroniserer IMAP for den aktuelle brugers konti direkte.
 * Kræver ikke agent-infrastrukturen.
 */
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  // Hent brugerens egne aktive konti
  const accounts = await sql`
    SELECT id, name, email, host, port, tls, username, password
    FROM imap_accounts
    WHERE active = true
      AND (
        ${session.role === 'admin' ? sql`1=1` : sql`user_id = ${session.id} OR user_id IS NULL`}
      )
  ` as unknown as Array<{
    id: string; name: string; email: string;
    host: string; port: number; tls: boolean;
    username: string; password: string;
  }>;

  if (accounts.length === 0) {
    return NextResponse.json({ ok: true, synced: 0, message: 'Ingen aktive konti' });
  }

  let totalNew = 0;
  const errors: string[] = [];

  for (const acc of accounts) {
    const client = new ImapFlow({
      host: acc.host,
      port: acc.port,
      secure: acc.tls,
      auth: { user: acc.username, pass: acc.password },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      const now = new Date().toISOString();

      try {
        const since = new Date();
        since.setDate(since.getDate() - 30); // Seneste 30 dage

        // Hent ALLE beskeder (ikke kun unseen), de-dupliker på uid
        for await (const msg of client.fetch({ since }, { envelope: true, source: true })) {
          const fromAddress = msg.envelope?.from?.[0];
          if (!fromAddress?.address) continue;

          const senderEmail = fromAddress.address.toLowerCase().trim();
          const senderName  = fromAddress.name || null;
          const subject     = msg.envelope?.subject || null;
          const receivedAt  = msg.envelope?.date?.toISOString() || now;

          // Dedupliker på imap_uid + account
          const [existing] = await sql`
            SELECT id FROM messages
            WHERE imap_account_id = ${acc.id} AND imap_uid = ${msg.uid}
          `;
          if (existing) continue;

          // Parse body
          let bodyText = '';
          let bodyHtml = '';
          try {
            if (msg.source) {
              const parsed = await simpleParser(msg.source as Buffer);
              bodyText = parsed.text  || '';
              bodyHtml = parsed.html  || '';
            }
          } catch { /* ignore parse errors */ }

          // Match til lead/kunde
          const [lead]     = await sql`SELECT id FROM leads     WHERE LOWER(email)         = ${senderEmail} LIMIT 1`;
          const [customer] = await sql`SELECT id FROM customers WHERE LOWER(contact_email) = ${senderEmail} LIMIT 1`;

          await sql`
            INSERT INTO messages (
              id, imap_account_id, imap_uid, direction,
              from_email, from_name, to_email, subject,
              body_text, body_html, lead_id, customer_id,
              read, received_at, created_at
            ) VALUES (
              ${randomUUID()}, ${acc.id}, ${msg.uid}, 'inbound',
              ${senderEmail}, ${senderName}, ${acc.email}, ${subject},
              ${bodyText}, ${bodyHtml},
              ${(lead as { id: string } | undefined)?.id || null},
              ${(customer as { id: string } | undefined)?.id || null},
              false, ${receivedAt}, ${now}
            )
          `;
          totalNew++;
        }
      } finally {
        lock.release();
      }

      // Opdater last_sync
      await sql`UPDATE imap_accounts SET last_sync = ${new Date().toISOString()} WHERE id = ${acc.id}`;
    } catch (err) {
      console.error(`[mail/sync] Fejl på konto ${acc.email}:`, err);
      errors.push(`${acc.email}: ${String(err)}`);
    } finally {
      try { await client.logout(); } catch { /* ignore */ }
    }
  }

  if (errors.length > 0 && totalNew === 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    synced: totalNew,
    accounts: accounts.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
