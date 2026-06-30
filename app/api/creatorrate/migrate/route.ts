import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await sql`
    CREATE TABLE IF NOT EXISTS cr_tickets (
      id            SERIAL PRIMARY KEY,
      type          TEXT NOT NULL CHECK (type IN ('dev', 'support')),
      status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
      priority      TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
      title         TEXT NOT NULL,
      description   TEXT,
      assignee_id   UUID REFERENCES users(id) ON DELETE SET NULL,
      reporter_name  TEXT,
      reporter_email TEXT,
      created_by    UUID REFERENCES users(id),
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS cr_tickets_type_idx   ON cr_tickets(type)`;
  await sql`CREATE INDEX IF NOT EXISTS cr_tickets_status_idx ON cr_tickets(status)`;

  return NextResponse.json({ ok: true });
}
