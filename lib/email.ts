import nodemailer from 'nodemailer';
import { Resend } from 'resend';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is not set');
    _resend = new Resend(key);
  }
  return _resend;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ id: string }> {
  const fromAddress = opts.from || process.env.EMAIL_FROM || 'BusyGroup <noreply@busyconsulting.dk>';

  // Try SMTP first if configured
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;

  if (smtpHost && smtpUser && smtpPassword) {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    const info = await transporter.sendMail({
      from: fromAddress,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo,
    });

    return { id: info.messageId || info.response || 'smtp-sent' };
  }

  // Fall back to Resend if configured
  if (process.env.RESEND_API_KEY) {
    const resend = getResend();

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo,
    });

    if (error) throw new Error(error.message);
    return { id: data!.id };
  }

  throw new Error(
    'No email transport configured. Set SMTP_HOST + SMTP_USER + SMTP_PASSWORD for SMTP, or RESEND_API_KEY for Resend.'
  );
}

// Simple plain-text → HTML wrapper for outreach messages
export function textToHtml(text: string): string {
  return text
    .split('\n')
    .map(line => line.trim() === '' ? '<br/>' : `<p style="margin:0 0 8px 0">${line}</p>`)
    .join('');
}
