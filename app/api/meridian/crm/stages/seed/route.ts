import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

const DEFAULT_STAGES = [
  { key: 'identificeret',   name: 'Identificeret',  color: '#4a5d78', probability: 5,   position: 0, is_won: false, is_lost: false },
  { key: 'foerste_kontakt', name: 'Første kontakt', color: '#4f8ef7', probability: 15,  position: 1, is_won: false, is_lost: false },
  { key: 'i_dialog',        name: 'I dialog',       color: '#4f8ef7', probability: 30,  position: 2, is_won: false, is_lost: false },
  { key: 'moede_booket',    name: 'Møde booket',    color: '#a78bfa', probability: 50,  position: 3, is_won: false, is_lost: false },
  { key: 'tilbud_sendt',    name: 'Tilbud sendt',   color: '#f59e0b', probability: 75,  position: 4, is_won: false, is_lost: false },
  { key: 'forhandling',     name: 'Forhandling',    color: '#ff6b35', probability: 85,  position: 5, is_won: false, is_lost: false },
  { key: 'vundet',          name: 'Vundet',         color: '#2dd4a0', probability: 100, position: 6, is_won: true,  is_lost: false },
  { key: 'tabt',            name: 'Tabt',           color: '#f43f5e', probability: 0,   position: 7, is_won: false, is_lost: true  },
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
