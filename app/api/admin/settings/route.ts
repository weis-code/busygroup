import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rows = await sql`SELECT key, value FROM settings`;
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Kun admin kan ændre indstillinger' }, { status: 403 });

  const body = await req.json() as Record<string, string>;
  for (const [key, value] of Object.entries(body)) {
    await sql`
      INSERT INTO settings (key, value) VALUES (${key}, ${String(value)})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
  }
  return NextResponse.json({ ok: true });
}
