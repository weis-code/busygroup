import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

// Personal CRM, same as Group's: each AM has their own stages, seeded from a
// standard default set on first use — no forcing every company onto one
// shared board. Using the exact same keys/labels as Group's own default means
// a deal's `stage` text lines up identically everywhere, with no mapping.
const DEFAULT_STAGES = [
  { key: 'lead',        name: 'Lead',        color: 'var(--t3)', probability: 5,   position: 0, is_won: false, is_lost: false },
  { key: 'kontaktet',   name: 'Kontaktet',   color: 'var(--bl)', probability: 20,  position: 1, is_won: false, is_lost: false },
  { key: 'demo',        name: 'Demo',        color: 'var(--pu)', probability: 40,  position: 2, is_won: false, is_lost: false },
  { key: 'tilbud',      name: 'Tilbud',      color: 'var(--ye)', probability: 65,  position: 3, is_won: false, is_lost: false },
  { key: 'forhandling', name: 'Forhandling', color: 'var(--or)', probability: 80,  position: 4, is_won: false, is_lost: false },
  { key: 'vundet',      name: 'Vundet',      color: 'var(--gr)', probability: 100, position: 5, is_won: true,  is_lost: false },
  { key: 'tabt',        name: 'Tabt',        color: 'var(--re)', probability: 0,   position: 6, is_won: false, is_lost: true  },
];

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now();
}

async function seedStages(ownerId: string) {
  const existing = await sql`
    SELECT s.id FROM crm_pipeline_stages s
    WHERE s.owner_id = ${ownerId} AND s.workspace_id = (SELECT id FROM companies WHERE slug = 'meridian')
    LIMIT 1
  `;
  if (existing.length > 0) return;
  for (const s of DEFAULT_STAGES) {
    await sql`
      INSERT INTO crm_pipeline_stages (owner_id, workspace_id, key, label, color, probability, position, is_won, is_lost)
      VALUES (${ownerId}, (SELECT id FROM companies WHERE slug = 'meridian'), ${s.key}, ${s.name}, ${s.color}, ${s.probability}, ${s.position}, ${s.is_won}, ${s.is_lost})
      ON CONFLICT (owner_id, key) DO NOTHING
    `;
  }
}

function forbidden() { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') return forbidden();
  try {
    await seedStages(session.id);
    const stages = await sql`
      SELECT id, label AS name, color, probability, position, is_won, is_lost
      FROM crm_pipeline_stages
      WHERE owner_id = ${session.id} AND workspace_id = (SELECT id FROM companies WHERE slug = 'meridian')
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
      WHERE owner_id = ${session.id} AND workspace_id = (SELECT id FROM companies WHERE slug = 'meridian')
    `;
    const key = slugify(body.name.trim());
    const [stage] = await sql`
      INSERT INTO crm_pipeline_stages (owner_id, workspace_id, key, label, color, probability, position)
      VALUES (
        ${session.id},
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
