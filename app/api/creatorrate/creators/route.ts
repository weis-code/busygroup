import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

async function ensureStatusTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS cr_creator_status (
      creator_id  TEXT PRIMARY KEY,
      status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'churned', 'trial', 'paused')),
      notes       TEXT,
      updated_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_by  UUID REFERENCES users(id) ON DELETE SET NULL
    )
  `;
}

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = process.env.CREATORRATE_SUPABASE_URL;
  const key = process.env.CREATORRATE_SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Supabase env vars mangler' }, { status: 500 });
  }

  await ensureStatusTable();

  const res = await fetch(`${url}/rest/v1/profiles?role=eq.creator&select=*&order=created_at.desc`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'count=exact',
    },
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Kunne ikke hente creators fra Supabase' }, { status: 502 });
  }

  const profiles = await res.json() as Record<string, unknown>[];

  const statuses = await sql`SELECT creator_id, status, notes, updated_at FROM cr_creator_status`;
  const statusMap = Object.fromEntries(
    (statuses as { creator_id: string; status: string; notes: string | null; updated_at: string }[])
      .map(s => [s.creator_id, s])
  );

  const creators = profiles.map(p => ({
    ...p,
    _status: statusMap[String(p.id)]?.status ?? 'active',
    _notes:  statusMap[String(p.id)]?.notes  ?? null,
    _status_updated_at: statusMap[String(p.id)]?.updated_at ?? null,
  }));

  return NextResponse.json(creators);
}
