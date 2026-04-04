import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sendViaSMTP } from '@/lib/smtp';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id       = searchParams.get('id');
  const threadId = searchParams.get('threadId');
  const folder   = searchParams.get('folder') || 'inbox';
  const accountId= searchParams.get('account') || null;
  const search   = searchParams.get('search') || null;
  const limit    = Math.min(Number(searchParams.get('limit') || 100), 500);

  // Single message
  if (id) {
    const [msg] = await sql`
      SELECT m.*, l.company AS lead_company, c.company AS customer_company
      FROM messages m
      LEFT JOIN leads l ON m.lead_id = l.id
      LEFT JOIN customers c ON m.customer_id = c.id
      WHERE m.id = ${id}
    `;
    if (!msg) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
    if (!msg.read && (msg as unknown as { draft: boolean }).draft !== true) {
      await sql`UPDATE messages SET read = true WHERE id = ${id}`;
    }
    return NextResponse.json(msg);
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  // All messages in a thread
  if (threadId) {
    const userFilter = session.role === 'admin'
      ? sql``
      : sql`AND (ia.user_id = ${session.id} OR ia.user_id IS NULL)`;
    const msgs = await sql`
      SELECT m.*, l.company AS lead_company, c.company AS customer_company, ia.name AS account_name, ia.email AS account_email
      FROM messages m
      LEFT JOIN leads l ON m.lead_id = l.id
      LEFT JOIN customers c ON m.customer_id = c.id
      INNER JOIN imap_accounts ia ON m.imap_account_id = ia.id
      WHERE m.thread_id = ${threadId} ${userFilter}
      ORDER BY m.received_at ASC
    `;
    return NextResponse.json(msgs);
  }

  // List
  const userFilter = session.role === 'admin' ? sql`` : sql`AND (ia.user_id = ${session.id} OR ia.user_id IS NULL)`;
  const accFilter  = accountId ? sql`AND m.imap_account_id = ${accountId}` : sql``;

  let dirFilter = sql`AND m.direction = 'inbound' AND m.draft = false`;
  if (folder === 'sent')    dirFilter = sql`AND m.direction = 'outbound' AND m.draft = false`;
  if (folder === 'drafts')  dirFilter = sql`AND m.draft = true`;
  if (folder === 'starred') dirFilter = sql`AND m.starred = true AND m.draft = false`;
  if (folder === 'all')     dirFilter = sql`AND m.draft = false`;

  const searchFilter = search
    ? sql`AND (m.subject ILIKE ${`%${search}%`} OR m.from_email ILIKE ${`%${search}%`} OR m.from_name ILIKE ${`%${search}%`} OR m.body_text ILIKE ${`%${search}%`})`
    : sql``;

  const emails = await sql`
    SELECT
      m.id, m.direction, m.from_email, m.from_name,
      m.to_email, m.to_name, m.subject,
      LEFT(m.body_text, 200) AS preview,
      m.read, m.starred, m.draft, m.received_at,
      m.lead_id, m.customer_id, m.imap_account_id,
      m.thread_id, m.message_id, m.in_reply_to,
      l.company  AS lead_company,
      c.company  AS customer_company,
      ia.name    AS account_name,
      ia.email   AS account_email
    FROM messages m
    LEFT JOIN leads          l  ON m.lead_id          = l.id
    LEFT JOIN customers      c  ON m.customer_id      = c.id
    INNER JOIN imap_accounts ia ON m.imap_account_id  = ia.id
    WHERE 1=1
    ${dirFilter}
    ${accFilter}
    ${searchFilter}
    ${userFilter}
    ORDER BY m.received_at DESC
    LIMIT ${limit}
  `;

  return NextResponse.json(emails);
}

// Toggle read / star / delete (single or bulk)
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const { ids, action } = await req.json() as { ids: string[]; action: string };
  if (!ids?.length) return NextResponse.json({ error: 'ids er påkrævet' }, { status: 400 });

  for (const id of ids) {
    if (action === 'read')    await sql`UPDATE messages SET read = true  WHERE id = ${id}`;
    if (action === 'unread')  await sql`UPDATE messages SET read = false WHERE id = ${id}`;
    if (action === 'star')    await sql`UPDATE messages SET starred = true  WHERE id = ${id}`;
    if (action === 'unstar')  await sql`UPDATE messages SET starred = false WHERE id = ${id}`;
    if (action === 'delete')  await sql`DELETE FROM messages WHERE id = ${id}`;
  }

  return NextResponse.json({ ok: true });
}

// Send email or save draft
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const { to, subject, body, fromAccountId, inReplyToId, draft = false } = await req.json();
  if (!draft && (!to || !body)) return NextResponse.json({ error: 'to og body er påkrævet' }, { status: 400 });

  // Resolve sender account
  let resolvedAccountId: string | null = fromAccountId || null;
  if (!resolvedAccountId) {
    const fallback = session.role === 'admin'
      ? await sql`SELECT id FROM imap_accounts WHERE active = true ORDER BY created_at ASC LIMIT 1`
      : await sql`SELECT id FROM imap_accounts WHERE active = true AND (user_id = ${session.id} OR user_id IS NULL) ORDER BY created_at ASC LIMIT 1`;
    if (fallback.length > 0) resolvedAccountId = (fallback[0] as unknown as { id: string }).id;
  }

  let fromEmail = process.env.OUTREACH_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@busyconsulting.dk';
  let fromName  = 'BusyGroup';
  if (resolvedAccountId) {
    const [acc] = await sql`SELECT name, email FROM imap_accounts WHERE id = ${resolvedAccountId}`;
    if (acc) { fromEmail = (acc as unknown as Record<string, string>).email; fromName = (acc as unknown as Record<string, string>).name; }
  }

  const msgSubject = subject || '(Intet emne)';
  const now = new Date().toISOString();

  // Save as draft
  if (draft) {
    const id = randomUUID();
    await sql`
      INSERT INTO messages (id, imap_account_id, direction, from_email, from_name, to_email, subject, body_text, read, starred, draft, received_at, created_at)
      VALUES (${id}, ${resolvedAccountId}, 'outbound', ${fromEmail}, ${fromName}, ${to || ''}, ${msgSubject}, ${body || ''}, true, false, true, ${now}, ${now})
    `;
    return NextResponse.json({ ok: true, id });
  }

  // Send via SMTP
  try {
    // Fetch reply context for in-reply-to header
    let inReplyToMessageId: string | undefined;
    let references: string | undefined;
    if (inReplyToId) {
      const [orig] = await sql`SELECT message_id, in_reply_to FROM messages WHERE id = ${inReplyToId}`;
      if (orig) {
        inReplyToMessageId = (orig as unknown as { message_id: string }).message_id;
        references = inReplyToMessageId;
      }
    }

    await sendViaSMTP({ fromAccountId: resolvedAccountId, to, subject: msgSubject, text: body, inReplyTo: inReplyToMessageId, references });
  } catch (smtpErr) {
    console.error('[mail/send] SMTP fejl:', smtpErr);
    return NextResponse.json({ error: `${String(smtpErr)}` }, { status: 500 });
  }

  const [lead]     = await sql`SELECT id FROM leads     WHERE email         = ${to} LIMIT 1`;
  const [customer] = await sql`SELECT id FROM customers WHERE contact_email = ${to} LIMIT 1`;

  const senderEmail = fromEmail.includes('<') ? fromEmail.replace(/.*<(.+)>.*/, '$1') : fromEmail;
  const msgId = randomUUID();
  await sql`
    INSERT INTO messages (id, imap_account_id, direction, from_email, from_name, to_email, subject, body_text, lead_id, customer_id, read, starred, draft, received_at, created_at)
    VALUES (${msgId}, ${resolvedAccountId}, 'outbound', ${senderEmail}, ${fromName}, ${to}, ${msgSubject}, ${body},
      ${(lead as unknown as Record<string, string>)?.id || null},
      ${(customer as unknown as Record<string, string>)?.id || null},
      true, false, false, ${now}, ${now})
  `;

  if (inReplyToId) await sql`UPDATE messages SET read = true WHERE id = ${inReplyToId}`;

  return NextResponse.json({ ok: true });
}
