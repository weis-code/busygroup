import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const userFilter = session.role === 'admin'
    ? sql``
    : sql`AND (ia.user_id = ${session.id} OR ia.user_id IS NULL)`;

  const rows = await sql`
    SELECT m.imap_account_id, COUNT(*)::int AS cnt
    FROM messages m
    INNER JOIN imap_accounts ia ON m.imap_account_id = ia.id
    WHERE m.read = false AND m.direction = 'inbound' AND m.draft = false
    ${userFilter}
    GROUP BY m.imap_account_id
  ` as unknown as Array<{ imap_account_id: string; cnt: number }>;

  const byAccount: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    byAccount[row.imap_account_id] = row.cnt;
    total += row.cnt;
  }

  return NextResponse.json({ total, byAccount });
}
