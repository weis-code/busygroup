import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS cr_tickets (
      id             SERIAL PRIMARY KEY,
      source         TEXT NOT NULL DEFAULT 'creatorrate',
      type           TEXT NOT NULL CHECK (type IN ('dev', 'support')),
      status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
      priority       TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
      title          TEXT NOT NULL,
      description    TEXT,
      assignee_id    UUID REFERENCES users(id) ON DELETE SET NULL,
      reporter_name  TEXT,
      reporter_email TEXT,
      created_by     UUID REFERENCES users(id),
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE cr_tickets ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'creatorrate'`.catch(() => {});
}

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await ensureTable();

  const source = req.nextUrl.searchParams.get('source') ?? 'group';
  const type   = req.nextUrl.searchParams.get('type');
  const status = req.nextUrl.searchParams.get('status');
  // source=all means "every company's tickets together" — the koncern-wide
  // default for the unified kundeservice view — filterable back down to one
  // company via the normal `source` param.
  const sourceFilter = source === 'all' ? sql`` : sql`AND t.source = ${source}`;

  const tickets = await sql`
    SELECT
      t.id, t.source, t.type, t.status, t.priority, t.title, t.description,
      t.customer_id, t.customer_name, t.category,
      t.reporter_name, t.reporter_email, t.resolved_at,
      t.created_at, t.updated_at,
      a.name AS assignee_name,
      c.name AS created_by_name
    FROM cr_tickets t
    LEFT JOIN users a ON a.id = t.assignee_id
    LEFT JOIN users c ON c.id = t.created_by
    WHERE TRUE
      ${sourceFilter}
      AND (${type}::text   IS NULL OR t.type   = ${type})
      AND (${status}::text IS NULL OR t.status = ${status})
    ORDER BY
      CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
      t.created_at DESC
  `;

  return NextResponse.json(tickets);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { source, type, priority, title, description, assignee_id, reporter_name, reporter_email } =
    await req.json() as {
      source?: string;
      type: string;
      priority?: string;
      title: string;
      description?: string;
      assignee_id?: string;
      reporter_name?: string;
      reporter_email?: string;
    };

  if (!type || !title) {
    return NextResponse.json({ error: 'type og title kræves' }, { status: 400 });
  }

  await ensureTable();

  const [ticket] = await sql`
    INSERT INTO cr_tickets (source, type, priority, title, description, assignee_id, reporter_name, reporter_email, created_by)
    VALUES (
      ${source ?? 'group'},
      ${type},
      ${priority ?? 'normal'},
      ${title},
      ${description ?? null},
      ${assignee_id ?? null},
      ${reporter_name ?? null},
      ${reporter_email ?? null},
      ${session.id}
    )
    RETURNING id, type, status, priority, title, created_at
  `;

  return NextResponse.json(ticket, { status: 201 });
}
