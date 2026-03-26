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
  const resend = getResend();
  const fromAddress = opts.from || process.env.EMAIL_FROM || 'BusyGroup <noreply@busyconsulting.dk>';

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

// Simple plain-text → HTML wrapper for outreach messages
export function textToHtml(text: string): string {
  return text
    .split('\n')
    .map(line => line.trim() === '' ? '<br/>' : `<p style="margin:0 0 8px 0">${line}</p>`)
    .join('');
}
