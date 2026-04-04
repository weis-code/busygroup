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
  id: string; name: string; email: string;
  smtp_host: string | null; smtp_port: number | null;
  smtp_secure: boolean | null; smtp_user: string | null; smtp_password: string | null;
  username: string; password: string; host: string;
}

function guessSmtp(imapHost: string): { host: string; port: number; secure: boolean } {
  const h = imapHost.toLowerCase();
  if (h.includes('gmail'))                           return { host: 'smtp.gmail.com',          port: 587, secure: false };
  if (h.includes('outlook') || h.includes('hotmail') || h.includes('live.'))
                                                     return { host: 'smtp-mail.outlook.com',   port: 587, secure: false };
  if (h.includes('office365'))                       return { host: 'smtp.office365.com',      port: 587, secure: false };
  if (h.includes('yahoo'))                           return { host: 'smtp.mail.yahoo.com',     port: 587, secure: false };
  if (h.includes('icloud') || h.includes('me.com'))  return { host: 'smtp.mail.me.com',        port: 587, secure: false };
  const smtpHost = h.startsWith('imap.') ? imapHost.replace(/^imap\./i, 'smtp.') : imapHost;
  return { host: smtpHost, port: 587, secure: false };
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
      FROM imap_accounts WHERE id = ${fromAccountId} AND active = true
    ` as unknown as ImapAccount[];
    const acc = rows[0];
    if (acc) {
      fromEmail  = acc.email;
      fromName   = acc.name;
      if (acc.smtp_host) {
        smtpHost     = acc.smtp_host;
        smtpPort     = acc.smtp_port     ?? 587;
        smtpSecure   = acc.smtp_secure   ?? false;
      } else {
        const guessed = guessSmtp(acc.host);
        smtpHost   = guessed.host;
        smtpPort   = guessed.port;
        smtpSecure = guessed.secure;
      }
      smtpUser     = acc.smtp_user     || acc.username;
      smtpPassword = acc.smtp_password || acc.password;
    }
  }

  if (!smtpHost || !smtpUser || !smtpPassword) {
    throw new Error(
      `SMTP ikke konfigureret — mangler: ${[!smtpHost && 'smtp_host', !smtpUser && 'smtp_user', !smtpPassword && 'smtp_password'].filter(Boolean).join(', ')}. Ret det under Indstillinger → rediger kontoen.`
    );
  }

  const fromAddress = fromEmail || smtpUser;
  const fromHeader  = fromName ? `"${fromName}" <${fromAddress}>` : fromAddress;

  console.log(`[SMTP] ${fromHeader} → ${to} via ${smtpHost}:${smtpPort} secure=${smtpSecure} user=${smtpUser}`);

  const transporter = nodemailer.createTransport({
    host: smtpHost, port: smtpPort, secure: smtpSecure,
    auth: { user: smtpUser, pass: smtpPassword },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
  });

  const info = await transporter.sendMail({
    from: fromHeader, to, subject,
    text,
    html: html || text.replace(/\n/g, '<br>'),
    inReplyTo, references,
  });

  console.log(`[SMTP] OK — messageId: ${info.messageId} response: ${info.response}`);
}
