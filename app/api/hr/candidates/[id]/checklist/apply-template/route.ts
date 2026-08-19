import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { template_id } = await req.json() as { template_id: number };

  const [candidate] = await sql`SELECT id, start_date::text FROM hr_candidates WHERE id = ${params.id}`;
  if (!candidate) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  if (!candidate.start_date) {
    return NextResponse.json({ error: 'Kandidaten skal have en opstartsdato for at anvende en skabelon' }, { status: 400 });
  }

  const items = await sql`
    SELECT id, title, description, position, days_before_start
    FROM recruitment_checklist_items
    WHERE template_id = ${template_id}
    ORDER BY position ASC
  `;
  if (items.length === 0) return NextResponse.json({ error: 'Skabelonen har ingen opgaver' }, { status: 400 });

  const [{ next_position }] = await sql`
    SELECT COALESCE(MAX(position), -1) + 1 AS next_position
    FROM recruitment_candidate_checklist WHERE candidate_id = ${params.id}
  `;

  const inserted = await sql`
    INSERT INTO recruitment_candidate_checklist (candidate_id, template_item_id, title, due_date, position)
    SELECT ${params.id}, i.id, i.title, (${candidate.start_date}::date - i.days_before_start), ${next_position} + i.position
    FROM recruitment_checklist_items i
    WHERE i.template_id = ${template_id}
    RETURNING id, candidate_id, template_item_id, title, is_completed, completed_at, completed_by, due_date::text, position
  `;
  return NextResponse.json(inserted, { status: 201 });
}
