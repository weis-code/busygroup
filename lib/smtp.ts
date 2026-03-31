import nodemailer from 'nodemailer';
import { sql } from '@/lib/db';

export interface SmtpSendOptions {
  fromAccountId?: string | null;
  to: string;
  subject: string;
  text: string;
  html?: string;
  inReplyTo?: string;
  references?: string;
}

interface ImapAccount {
  id: string;
  name: string;
  email: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: boolean | null;
  smtp_user: string | null;
  smtp_password: string | null;
  username: string;
  password: string;
  host: string;
}

export async function sendViaSMTP(opts: SmtpSendOptions): Promise<void> {
  const { fromAccountId, to, subject, text, html, inReplyTo, references } = opts;

  let fromEmail    = '';
  let fromName     = 'BusyGroup';
  let smtpHost     = process.env.SMTP_HOST || '';
  let smtpPort     = Number(process.env.SMTP_PORT || 587);
  let smtpSecure   = process.env.SMTP_SECURE === 'true';
  let smtpUser     = process.env.SMTP_USER || '';
  let smtpPassword = process.env.SMTP_PASSWORD || '';

  if (fromAccountId) {
    const rows = await sql`
      SELECT id, name, email, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, username, password, host
      FROM imap_accounts
      WHERE id = ${fromAccountId} AND active = true
    ` as unknown as ImapAccount[];

    const acc = rows[0];
    if (acc) {
      fromEmail    = acc.email;
      fromName     = acc.name;
      smtpHost     = acc.smtp_host     || acc.host.replace(/^imap\./, 'smtp.');
      smtpPort     = acc.smtp_port     ?? 587;
      smtpSecure   = acc.smtp_secure   ?? false;
      // SMTP user = smtp_user if set, else fall back to IMAP username (often the email address)
      smtpUser     = acc.smtp_user     || acc.username;
      smtpPassword = acc.smtp_password || acc.password;
    }
  }

  if (!smtpHost || !smtpUser || !smtpPassword) {
    throw new Error(
      `SMTP ikke konfigureret — mangler: ${[
        !smtpHost ? 'smtp_host' : '',
        !smtpUser ? 'smtp_user' : '',
        !smtpPassword ? 'smtp_password' : '',
      ].filter(Boolean).join(', ')}. Ret det under Indstillinger → rediger kontoen.`
    );
  }

  // FROM skal matche den autentificerede SMTP-bruger for de fleste udbydere
  // Brug den eksakte email-adresse — ikke "Navn <email>" — hvis from er tom
  const fromAddress = fromEmail || smtpUser;
  const fromHeader  = fromName ? `"${fromName}" <${fromAddress}>` : fromAddress;

  console.log(`[SMTP] Sender: ${fromHeader} → ${to} via ${smtpHost}:${smtpPort} (secure=${smtpSecure}, user=${smtpUser})`);

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: smtpUser, pass: smtpPassword },
    tls: { rejectUnauthorized: false },
  });

  const info = await transporter.sendMail({
    from:       fromHeader,
    to,
    subject,
    text,
    html:       html || text.replace(/\n/g, '<br>'),
    inReplyTo,
    references,
  });

  console.log(`[SMTP] Sendt OK — messageId: ${info.messageId}, response: ${info.response}`);
}
