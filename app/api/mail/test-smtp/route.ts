/**
 * POST /api/mail/test-smtp
 * Sender en rigtig test-email til kontoen selv og returnerer diagnostik.
 */
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const accounts = session.role === 'admin'
    ? await sql`SELECT id, name, email, host, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, username, password FROM imap_accounts WHERE active = true ORDER BY created_at ASC`
    : await sql`SELECT id, name, email, host, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, username, password FROM imap_accounts WHERE active = true AND (user_id = ${session.id} OR user_id IS NULL) ORDER BY created_at ASC`;

  if (accounts.length === 0) {
    return NextResponse.json({ ok: false, error: 'Ingen aktive konti fundet' });
  }

  const results = [];

  for (const acc of accounts as unknown as Array<{
    id: string; name: string; email: string; host: string;
    smtp_host: string | null; smtp_port: number | null; smtp_secure: boolean | null;
    smtp_user: string | null; smtp_password: string | null;
    username: string; password: string;
  }>) {
    const smtpHost     = acc.smtp_host     || acc.host.replace(/^imap\./, 'smtp.');
    const smtpPort     = acc.smtp_port     ?? 587;
    const smtpSecure   = acc.smtp_secure   ?? false;
    const smtpUser     = acc.smtp_user     || acc.username;
    const smtpPassword = acc.smtp_password || acc.password;
    const fromAddress  = acc.email || smtpUser;

    const config = {
      account: acc.name,
      from: fromAddress,
      smtp_host: smtpHost,
      smtp_port: smtpPort,
      smtp_secure: smtpSecure,
      smtp_user: smtpUser,
      has_password: !!smtpPassword,
      host_source: acc.smtp_host ? 'smtp felter i DB' : `gættet fra imap host (${acc.host})`,
    };

    if (!smtpHost || !smtpUser || !smtpPassword) {
      results.push({ ...config, ok: false, error: 'Mangler smtp_host, user eller password — ret det i Indstillinger' });
      continue;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPassword },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000,
        greetingTimeout: 8000,
      });

      // Send en rigtig test-email til kontoen selv
      const info = await transporter.sendMail({
        from:    `"${acc.name}" <${fromAddress}>`,
        to:      fromAddress,
        subject: `BusyGroup SMTP test — ${new Date().toLocaleTimeString('da-DK')}`,
        text:    `Dette er en automatisk test fra BusyGroup Mail.\n\nHvis du modtager denne email virker din SMTP-opsætning korrekt.\n\nKonto: ${acc.name}\nSMTP: ${smtpHost}:${smtpPort}`,
      });

      results.push({ ...config, ok: true, messageId: info.messageId, response: info.response });
    } catch (e) {
      results.push({ ...config, ok: false, error: String(e) });
    }
  }

  return NextResponse.json({ results });
}
