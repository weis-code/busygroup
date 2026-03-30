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

/**
 * Send email via SMTP using credentials from imap_accounts table.
 * Falls back to env vars (SMTP_HOST etc.) if no account is found.
 */
export async function sendViaSMTP(opts: SmtpSendOptions): Promise<void> {
  const { fromAccountId, to, subject, text, html, inReplyTo, references } = opts;

  let fromEmail = process.env.OUTREACH_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@busyconsulting.dk';
  let fromName  = 'BusyGroup';
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
      fromEmail  = acc.email;
      fromName   = acc.name;

      // Brug SMTP-felter hvis de er sat, ellers forsøg IMAP-host som fallback
      smtpHost     = acc.smtp_host     || acc.host.replace('imap.', 'smtp.');
      smtpPort     = acc.smtp_port     ?? 587;
      smtpSecure   = acc.smtp_secure   ?? false;
      smtpUser     = acc.smtp_user     || acc.username;
      smtpPassword = acc.smtp_password || acc.password;
    }
  }

  if (!smtpHost || !smtpUser || !smtpPassword) {
    throw new Error(
      'SMTP ikke konfigureret. Tilføj smtp_host, smtp_user og smtp_password på email-kontoen i Indstillinger.'
    );
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,       // true = port 465, false = STARTTLS på 587
    auth: { user: smtpUser, pass: smtpPassword },
    tls: { rejectUnauthorized: false },
  });

  await transporter.sendMail({
    from:       `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    text,
    html:       html || text.replace(/\n/g, '<br>'),
    inReplyTo,
    references,
  });
}
