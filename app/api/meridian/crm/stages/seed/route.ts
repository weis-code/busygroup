import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

const DEFAULT_STAGES = [
  { key: 'lead',        name: 'Lead',        color: 'var(--t3)', probability: 5,   position: 0, is_won: false, is_lost: false },
  { key: 'kontaktet',   name: 'Kontaktet',   color: 'var(--bl)', probability: 20,  position: 1, is_won: false, is_lost: false },
  { key: 'demo',        name: 'Demo',        color: 'var(--pu)', probability: 40,  position: 2, is_won: false, is_lost: false },
  { key: 'tilbud',      name: 'Tilbud',      color: 'var(--ye)', probability: 65,  position: 3, is_won: false, is_lost: false },
  { key: 'forhandling', name: 'Forhandling', color: 'var(--or)', probability: 80,  position: 4, is_won: false, is_lost: false },
  { key: 'vundet',      name: 'Vundet',      color: 'var(--gr)', probability: 100, position: 5, is_won: true,  is_lost: false },
  { key: 'tabt',        name: 'Tabt',        color: 'var(--re)', probability: 0,   position: 6, is_won: false, is_lost: true  },
];

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const [row] = await sql`
    SELECT COUNT(*)::int AS count FROM crm_pipeline_stages
    WHERE owner_id = ${session.id} AND workspace_id = (SELECT id FROM companies WHERE slug = 'meridian')
  `;
  if (Number(row.count) > 0) return NextResponse.json({ seeded: false });

  for (const s of DEFAULT_STAGES) {
    await sql`
      INSERT INTO crm_pipeline_stages (owner_id, workspace_id, key, label, color, probability, position, is_won, is_lost)
      VALUES (${session.id}, (SELECT id FROM companies WHERE slug = 'meridian'), ${s.key}, ${s.name}, ${s.color}, ${s.probability}, ${s.position}, ${s.is_won}, ${s.is_lost})
      ON CONFLICT (owner_id, key) DO NOTHING
    `;
  }
  return NextResponse.json({ seeded: true });
}
