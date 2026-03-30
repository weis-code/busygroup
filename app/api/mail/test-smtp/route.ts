/**
 * POST /api/mail/test-smtp
 * Tester SMTP-forbindelsen for den aktuelle brugers konto og returnerer
 * diagnostikinformation (uden at sende en rigtig email).
 */
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  // Hent brugerens konti
  const accounts = session.role === 'admin'
    ? await sql`SELECT id, name, email, host, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, username, password FROM imap_accounts WHERE active = true ORDER BY created_at ASC`
    : await sql`SELECT id, name, email, host, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, username, password FROM imap_accounts WHERE active = true AND (user_id = ${session.id} OR user_id IS NULL) ORDER BY created_at ASC`;

  if (accounts.length === 0) {
    return NextResponse.json({ ok: false, error: 'Ingen aktive IMAP-konti fundet', accounts: [] });
  }

  const results = [];

  for (const acc of accounts as unknown as Array<{
    id: string; name: string; email: string; host: string;
    smtp_host: string | null; smtp_port: number | null; smtp_secure: boolean | null;
    smtp_user: string | null; smtp_password: string | null;
    username: string; password: string;
  }>) {
    const smtpHost     = acc.smtp_host     || acc.host.replace('imap.', 'smtp.');
    const smtpPort     = acc.smtp_port     ?? 587;
    const smtpSecure   = acc.smtp_secure   ?? false;
    const smtpUser     = acc.smtp_user     || acc.username;
    const hasPassword  = !!(acc.smtp_password || acc.password);

    const config = {
      account: acc.name,
      email: acc.email,
      smtp_host: smtpHost,
      smtp_port: smtpPort,
      smtp_secure: smtpSecure,
      smtp_user: smtpUser,
      has_password: hasPassword,
      source: acc.smtp_host ? 'database smtp felter' : 'gættet fra imap host',
    };

    if (!smtpHost || !smtpUser || !hasPassword) {
      results.push({ ...config, ok: false, error: 'Mangler smtp_host, bruger eller password' });
      continue;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: acc.smtp_password || acc.password },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 8000,
        greetingTimeout: 5000,
      });

      await transporter.verify();
      results.push({ ...config, ok: true });
    } catch (e) {
      results.push({ ...config, ok: false, error: String(e) });
    }
  }

  return NextResponse.json({ results });
}
