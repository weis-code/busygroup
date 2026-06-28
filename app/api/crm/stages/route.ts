import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now();
}

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const stages = await sql`
      SELECT * FROM crm_pipeline_stages
      WHERE owner_id = ${session.id}
      ORDER BY position ASC, id ASC
    `;
    return NextResponse.json(stages);
  } catch {
    // Table might not exist yet — migration will create it on next page load
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { label, color, probability } = await req.json();
  if (!label?.trim()) return NextResponse.json({ error: 'Navn kræves' }, { status: 400 });

  // Place new stage before won/lost
  const [maxPos] = await sql`
    SELECT COALESCE(MAX(position), 0) AS mp FROM crm_pipeline_stages
    WHERE owner_id = ${session.id} AND is_won = FALSE AND is_lost = FALSE
  `;
  const position = (maxPos?.mp ?? 0) + 1;

  // Shift won/lost stages down to stay last
  await sql`
    UPDATE crm_pipeline_stages SET position = position + 1
    WHERE owner_id = ${session.id} AND (is_won = TRUE OR is_lost = TRUE)
  `;

  const key = slugify(label.trim());
  const [stage] = await sql`
    INSERT INTO crm_pipeline_stages (owner_id, key, label, color, probability, position)
    VALUES (
      ${session.id},
      ${key},
      ${label.trim()},
      ${(color as string) ?? 'var(--bl)'},
      ${probability != null ? Number(probability) : 50},
      ${position}
    )
    RETURNING *
  `;
  return NextResponse.json(stage, { status: 201 });
}
