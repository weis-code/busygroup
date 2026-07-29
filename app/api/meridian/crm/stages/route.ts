import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

// Meridian's pipeline is one shared team board (everyone with CRM access sees and
// works in the same pipeline) — stage rows have owner_id IS NULL, scoped only by
// workspace_id. Seeding the defaults happens once at boot in instrumentation.ts.
function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now();
}

function forbidden() { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') return forbidden();
  try {
    const stages = await sql`
      SELECT id, label AS name, color, probability, position, is_won, is_lost
      FROM crm_pipeline_stages
      WHERE owner_id IS NULL AND workspace_id = (SELECT id FROM companies WHERE slug = 'meridian')
      ORDER BY position, id
    `;
    return NextResponse.json(stages);
  } catch (err) {
    console.error('[Meridian] stages GET failed:', err);
    return NextResponse.json({ error: 'Database error', detail: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') return forbidden();
  const body = await req.json() as { name: string; color?: string; probability?: number };
  if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });

  try {
    const [maxPos] = await sql`
      SELECT COALESCE(MAX(position), -1) AS pos FROM crm_pipeline_stages
      WHERE owner_id IS NULL AND workspace_id = (SELECT id FROM companies WHERE slug = 'meridian')
    `;
    const key = slugify(body.name.trim());
    const [stage] = await sql`
      INSERT INTO crm_pipeline_stages (owner_id, workspace_id, key, label, color, probability, position)
      VALUES (
        NULL,
        (SELECT id FROM companies WHERE slug = 'meridian'),
        ${key},
        ${body.name.trim()},
        ${body.color ?? '#4f8ef7'},
        ${body.probability ?? 50},
        ${Number(maxPos.pos) + 1}
      )
      RETURNING id, label AS name, color, probability, position, is_won, is_lost
    `;
    return NextResponse.json(stage, { status: 201 });
  } catch (err) {
    console.error('[Meridian] stages POST failed:', err);
    return NextResponse.json({ error: 'Database error', detail: String(err) }, { status: 500 });
  }
}
