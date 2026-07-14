import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

const DEFAULT_STAGES = [
  { name: 'Identificeret',  color: '#4a5d78', probability: 5,   position: 0, is_won: false, is_lost: false },
  { name: 'Første kontakt', color: '#4f8ef7', probability: 15,  position: 1, is_won: false, is_lost: false },
  { name: 'I dialog',       color: '#4f8ef7', probability: 30,  position: 2, is_won: false, is_lost: false },
  { name: 'Møde booket',    color: '#a78bfa', probability: 50,  position: 3, is_won: false, is_lost: false },
  { name: 'Tilbud sendt',   color: '#f59e0b', probability: 75,  position: 4, is_won: false, is_lost: false },
  { name: 'Forhandling',    color: '#ff6b35', probability: 85,  position: 5, is_won: false, is_lost: false },
  { name: 'Vundet',         color: '#2dd4a0', probability: 100, position: 6, is_won: true,  is_lost: false },
  { name: 'Tabt',           color: '#f43f5e', probability: 0,   position: 7, is_won: false, is_lost: true  },
];

async function seedStages(ownerId: string) {
  const existing = await sql`
    SELECT id FROM meridian_pipeline_stages WHERE owner_id = ${ownerId} LIMIT 1
  `;
  if (existing.length > 0) return;
  for (const s of DEFAULT_STAGES) {
    await sql`
      INSERT INTO meridian_pipeline_stages (owner_id, name, color, probability, position, is_won, is_lost)
      VALUES (${ownerId}, ${s.name}, ${s.color}, ${s.probability}, ${s.position}, ${s.is_won}, ${s.is_lost})
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
      SELECT * FROM meridian_pipeline_stages
      WHERE owner_id = ${session.id}
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
      SELECT COALESCE(MAX(position), -1) AS pos FROM meridian_pipeline_stages WHERE owner_id = ${session.id}
    `;
    const [stage] = await sql`
      INSERT INTO meridian_pipeline_stages (owner_id, name, color, probability, position)
      VALUES (${session.id}, ${body.name.trim()}, ${body.color ?? '#4f8ef7'}, ${body.probability ?? 50}, ${Number(maxPos.pos) + 1})
      RETURNING *
    `;
    return NextResponse.json(stage, { status: 201 });
  } catch (err) {
    console.error('[Meridian] stages POST failed:', err);
    return NextResponse.json({ error: 'Database error', detail: String(err) }, { status: 500 });
  }
}
