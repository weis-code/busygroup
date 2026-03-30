import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sendEmail, textToHtml } from '@/lib/email';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

// Hent beskeder — grupperet som samtale-tråde per kontakt
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const thread = searchParams.get('thread'); // en kontakt-email → hent tråd
  const unreadOnly = searchParams.get('unread') === 'true';

  if (thread) {
    // Hent alle beskeder i tråden (inbound fra denne email + outbound til denne email)
    const messages = await sql`
      SELECT m.*,
        l.company as lead_company, l.contact_name as lead_name, l.status as lead_status,
        c.company as customer_company
      FROM messages m
      LEFT JOIN leads l ON m.lead_id = l.id
      LEFT JOIN customers c ON m.customer_id = c.id
      WHERE m.from_email = ${thread} OR m.to_email = ${thread}
      ORDER BY m.received_at ASC
    `;

    // Marker indgående som læst
    await sql`
      UPDATE messages SET read = true
      WHERE from_email = ${thread} AND direction = 'inbound' AND read = false
    `;

    return NextResponse.json(messages);
  }

  // Hent samtale-liste: seneste besked per kontakt
  const conversations = await sql`
    SELECT DISTINCT ON (CASE WHEN direction = 'inbound' THEN from_email ELSE to_email END)
      CASE WHEN direction = 'inbound' THEN from_email ELSE to_email END AS contact_email,
      CASE WHEN direction = 'inbound' THEN from_name  ELSE to_name   END AS contact_name,
      subject, body_text, direction, received_at, read,
      lead_id, customer_id,
      l.company            AS lead_company,
      l.contact_name       AS lead_contact_name,
      c.company            AS customer_company,
      (
        SELECT COUNT(*) FROM messages m2
        WHERE (
          m2.from_email = CASE WHEN messages.direction = 'inbound' THEN messages.from_email ELSE messages.to_email END
          OR
          m2.to_email   = CASE WHEN messages.direction = 'inbound' THEN messages.from_email ELSE messages.to_email END
        )
        AND m2.direction = 'inbound'
        AND m2.read = false
      ) AS unread_count
    FROM messages
    LEFT JOIN leads     l ON messages.lead_id     = l.id
    LEFT JOIN customers c ON messages.customer_id = c.id
    ${unreadOnly ? sql`WHERE read = false AND direction = 'inbound'` : sql``}
    ORDER BY CASE WHEN direction = 'inbound' THEN from_email ELSE to_email END, received_at DESC
  `;

  return NextResponse.json(conversations);
}

// Send en ny besked
export async function POST(req: NextRequest) {
  const { to, subject, body, fromEmail, fromName } = await req.json();
  if (!to || !body) return NextResponse.json({ error: 'to og body er påkrævet' }, { status: 400 });

  const outEmail = fromEmail || process.env.OUTREACH_FROM_EMAIL || process.env.EMAIL_FROM || 'BusyGroup <noreply@busyconsulting.dk>';
  const msgSubject = subject || 'Besked fra BusyGroup';

  await sendEmail({
    to,
    subject: msgSubject,
    html: textToHtml(body),
    text: body,
    from: outEmail,
    replyTo: outEmail,
  });

  // Match til lead/kunde
  const [lead] = await sql`SELECT id FROM leads WHERE email = ${to} LIMIT 1`;
  const [customer] = await sql`SELECT id FROM customers WHERE contact_email = ${to} LIMIT 1`;

  const now = new Date().toISOString();
  await sql`
    INSERT INTO messages (id, direction, from_email, from_name, to_email, subject, body_text, lead_id, customer_id, read, received_at, created_at)
    VALUES (
      ${randomUUID()}, 'outbound',
      ${outEmail.replace(/.*<(.+)>/, '$1')},
      ${fromName || 'BusyGroup'},
      ${to}, ${msgSubject}, ${body},
      ${lead?.id || null}, ${customer?.id || null},
      true, ${now}, ${now}
    )
  `;

  return NextResponse.json({ ok: true });
}
