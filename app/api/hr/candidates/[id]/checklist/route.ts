import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const items = await sql`
    SELECT cl.id, cl.candidate_id, cl.template_item_id, cl.title, cl.is_completed, cl.completed_at,
           cl.completed_by, u.name AS completed_by_name, cl.due_date::text, cl.position
    FROM recruitment_candidate_checklist cl
    LEFT JOIN users u ON u.id = cl.completed_by
    WHERE cl.candidate_id = ${params.id}
    ORDER BY cl.is_completed ASC, cl.position ASC, cl.id ASC
  `;
  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { title, due_date } = await req.json() as { title: string; due_date?: string | null };
  if (!title?.trim()) return NextResponse.json({ error: 'Titel kræves' }, { status: 400 });

  const [{ next_position }] = await sql`
    SELECT COALESCE(MAX(position), -1) + 1 AS next_position
    FROM recruitment_candidate_checklist WHERE candidate_id = ${params.id}
  `;

  const [item] = await sql`
    INSERT INTO recruitment_candidate_checklist (candidate_id, title, due_date, position)
    VALUES (${params.id}, ${title.trim()}, ${due_date ?? null}, ${next_position})
    RETURNING id, candidate_id, template_item_id, title, is_completed, completed_at, completed_by, due_date::text, position
  `;
  return NextResponse.json(item, { status: 201 });
}
