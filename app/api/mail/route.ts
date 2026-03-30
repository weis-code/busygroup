import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sendViaSMTP } from '@/lib/smtp';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

// Hent emails til mail-klienten
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const folder   = searchParams.get('folder') || 'inbox';   // inbox | sent
  const accountId = searchParams.get('account') || null;
  const id       = searchParams.get('id') || null;
  const limit    = Number(searchParams.get('limit') || 50);

  // Hent enkelt email
  if (id) {
    const [msg] = await sql`
      SELECT m.*,
        l.company  AS lead_company,
        l.status   AS lead_status,
        c.company  AS customer_company
      FROM messages m
      LEFT JOIN leads     l ON m.lead_id     = l.id
      LEFT JOIN customers c ON m.customer_id = c.id
      WHERE m.id = ${id}
    `;
    if (!msg) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
    // Marker som læst
    if (!msg.read) await sql`UPDATE messages SET read = true WHERE id = ${id}`;
    return NextResponse.json(msg);
  }

  // Hent email-liste
  // Kun vis emails for brugerens egne konti
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const dirFilter = folder === 'sent' ? sql`AND m.direction = 'outbound'` : sql`AND m.direction = 'inbound'`;
  const accFilter = accountId ? sql`AND m.imap_account_id = ${accountId}` : sql``;
  // Admin ser alle konti, andre brugere kun egne
  const userFilter = session.role === 'admin'
    ? sql``
    : sql`AND (ia.user_id = ${session.id} OR ia.user_id IS NULL)`;

  const emails = await sql`
    SELECT
      m.id, m.direction, m.from_email, m.from_name,
      m.to_email, m.to_name, m.subject,
      LEFT(m.body_text, 120) AS preview,
      m.read, m.received_at,
      m.lead_id, m.customer_id,
      m.imap_account_id,
      l.company  AS lead_company,
      c.company  AS customer_company,
      ia.name    AS account_name
    FROM messages m
    LEFT JOIN leads          l  ON m.lead_id          = l.id
    LEFT JOIN customers      c  ON m.customer_id      = c.id
    INNER JOIN imap_accounts ia ON m.imap_account_id  = ia.id
    WHERE 1=1
    ${dirFilter}
    ${accFilter}
    ${userFilter}
    ORDER BY m.received_at DESC
    LIMIT ${limit}
  `;

  return NextResponse.json(emails);
}

// Send ny email
export async function POST(req: NextRequest) {
  const { to, subject, body, fromAccountId, inReplyToId } = await req.json();
  if (!to || !body) return NextResponse.json({ error: 'to og body er påkrævet' }, { status: 400 });

  // Find afsenderkonto
  let fromEmail = process.env.OUTREACH_FROM_EMAIL || process.env.EMAIL_FROM || 'BusyGroup <noreply@busyconsulting.dk>';
  let fromName  = 'BusyGroup';
  let accountId: string | null = null;

  if (fromAccountId) {
    const [acc] = await sql`SELECT * FROM imap_accounts WHERE id = ${fromAccountId}`;
    if (acc) {
      fromEmail = `${(acc as unknown as Record<string,string>).name} <${(acc as unknown as Record<string,string>).email}>`;
      fromName  = (acc as unknown as Record<string,string>).name;
      accountId = fromAccountId;
    }
  }

  const msgSubject = subject || '(Intet emne)';

  try {
    await sendViaSMTP({
      fromAccountId: fromAccountId || accountId,
      to,
      subject: msgSubject,
      text: body,
    });
  } catch (smtpErr) {
    console.error('[mail/send] SMTP fejl:', smtpErr);
    return NextResponse.json(
      { error: `SMTP fejl: ${String(smtpErr)}` },
      { status: 500 }
    );
  }

  // Match til lead/kunde
  const [lead]     = await sql`SELECT id FROM leads     WHERE email         = ${to} LIMIT 1`;
  const [customer] = await sql`SELECT id FROM customers WHERE contact_email = ${to} LIMIT 1`;

  const now = new Date().toISOString();
  const senderEmail = fromEmail.includes('<') ? fromEmail.replace(/.*<(.+)>.*/, '$1') : fromEmail;
  await sql`
    INSERT INTO messages (
      id, imap_account_id, direction, from_email, from_name,
      to_email, subject, body_text,
      lead_id, customer_id, read, received_at, created_at
    ) VALUES (
      ${randomUUID()}, ${accountId},
      'outbound', ${senderEmail}, ${fromName},
      ${to}, ${msgSubject}, ${body},
      ${(lead as unknown as Record<string,string>)?.id || null},
      ${(customer as unknown as Record<string,string>)?.id || null},
      true, ${now}, ${now}
    )
  `;

  if (inReplyToId) {
    await sql`UPDATE messages SET read = true WHERE id = ${inReplyToId}`;
  }

  return NextResponse.json({ ok: true });
}
