/**
 * POST /api/mail/sync — inkrementel IMAP sync (UID-baseret, kun nye beskeder)
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

  const accounts = session.role === 'admin'
    ? await sql`SELECT id, name, email, host, port, tls, username, password, last_uid FROM imap_accounts WHERE active = true ORDER BY created_at ASC`
    : await sql`SELECT id, name, email, host, port, tls, username, password, last_uid FROM imap_accounts WHERE active = true AND (user_id = ${session.id} OR user_id IS NULL) ORDER BY created_at ASC`;

  if (accounts.length === 0) return NextResponse.json({ ok: true, synced: 0, message: 'Ingen aktive konti' });

  let totalNew = 0;
  const errors: string[] = [];

  for (const acc of accounts as unknown as Array<{
    id: string; name: string; email: string; host: string;
    port: number; tls: boolean; username: string; password: string; last_uid: number | null;
  }>) {
    const client = new ImapFlow({
      host: acc.host, port: acc.port, secure: acc.tls,
      auth: { user: acc.username, pass: acc.password },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      const now = new Date().toISOString();
      const lastUid = Number(acc.last_uid || 0);
      let maxUid = lastUid;

      try {
        // UID-baseret fetch: kun nye beskeder siden sidst
        // Ved første sync: brug 7-dages SINCE for at undgå at hente hele indbakken
        let fetchRange: string | object;
        if (lastUid > 0) {
          fetchRange = `${lastUid + 1}:*`;
        } else {
          const since = new Date();
          since.setDate(since.getDate() - 14);
          fetchRange = { since };
        }

        for await (const msg of client.fetch(fetchRange as Parameters<typeof client.fetch>[0], { envelope: true, source: true }, { uid: lastUid > 0 })) {
          const uid = msg.uid;
          if (uid && uid > maxUid) maxUid = uid;

          // Deduplication
          if (uid) {
            const [existing] = await sql`SELECT id FROM messages WHERE imap_account_id = ${acc.id} AND imap_uid = ${uid}`;
            if (existing) continue;
          }

          const fromAddress = msg.envelope?.from?.[0];
          if (!fromAddress?.address) continue;

          const senderEmail = fromAddress.address.toLowerCase().trim();
          const senderName  = fromAddress.name || null;
          const subject     = msg.envelope?.subject || null;
          const receivedAt  = msg.envelope?.date?.toISOString() || now;

          let bodyText = '';
          let bodyHtml = '';
          let messageId: string | null = null;
          let inReplyTo: string | null = null;

          try {
            if (msg.source) {
              const parsed = await simpleParser(msg.source as Buffer);
              bodyText  = parsed.text  || '';
              bodyHtml  = parsed.html  || '';
              messageId = parsed.messageId || null;
              inReplyTo = (parsed.inReplyTo as string | null) || null;
            }
          } catch { /* ignore parse errors */ }

          // Compute thread_id: look up parent message, else use own messageId
          let threadId: string | null = messageId;
          if (inReplyTo) {
            const [parent] = await sql`SELECT thread_id FROM messages WHERE message_id = ${inReplyTo} LIMIT 1`;
            if (parent && (parent as unknown as { thread_id: string }).thread_id) {
              threadId = (parent as unknown as { thread_id: string }).thread_id;
            }
          }

          const [lead]     = await sql`SELECT id FROM leads     WHERE LOWER(email)         = ${senderEmail} LIMIT 1`;
          const [customer] = await sql`SELECT id FROM customers WHERE LOWER(contact_email) = ${senderEmail} LIMIT 1`;

          await sql`
            INSERT INTO messages (
              id, imap_account_id, imap_uid, direction,
              from_email, from_name, to_email, subject,
              body_text, body_html, message_id, in_reply_to, thread_id,
              lead_id, customer_id, read, starred, draft, received_at, created_at
            ) VALUES (
              ${randomUUID()}, ${acc.id}, ${uid || null}, 'inbound',
              ${senderEmail}, ${senderName}, ${acc.email}, ${subject},
              ${bodyText}, ${bodyHtml}, ${messageId}, ${inReplyTo}, ${threadId},
              ${(lead as { id: string } | undefined)?.id || null},
              ${(customer as { id: string } | undefined)?.id || null},
              false, false, false, ${receivedAt}, ${now}
            )
          `;
          totalNew++;
        }
      } finally {
        lock.release();
      }

      // Opdater last_uid og last_sync
      if (maxUid > lastUid) {
        await sql`UPDATE imap_accounts SET last_uid = ${maxUid}, last_sync = ${now} WHERE id = ${acc.id}`;
      } else {
        await sql`UPDATE imap_accounts SET last_sync = ${now} WHERE id = ${acc.id}`;
      }
    } catch (err) {
      console.error(`[mail/sync] Fejl på ${acc.email}:`, err);
      errors.push(`${acc.email}: ${String(err)}`);
    } finally {
      try { await client.logout(); } catch { /* ignore */ }
    }
  }

  if (errors.length > 0 && totalNew === 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 500 });
  }

  return NextResponse.json({ ok: true, synced: totalNew, accounts: accounts.length, errors: errors.length > 0 ? errors : undefined });
}
