import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const items = await sql`
    SELECT id, template_id, title, description, position, days_before_start, created_at
    FROM recruitment_checklist_items
    WHERE template_id = ${params.id}
    ORDER BY position ASC
  `;
  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { title, description, days_before_start } = await req.json() as {
    title: string; description?: string | null; days_before_start?: number;
  };
  if (!title?.trim()) return NextResponse.json({ error: 'Titel kræves' }, { status: 400 });

  const [{ next_position }] = await sql`
    SELECT COALESCE(MAX(position), -1) + 1 AS next_position
    FROM recruitment_checklist_items WHERE template_id = ${params.id}
  `;

  const [item] = await sql`
    INSERT INTO recruitment_checklist_items (template_id, title, description, position, days_before_start)
    VALUES (${params.id}, ${title.trim()}, ${description ?? null}, ${next_position}, ${days_before_start ?? 0})
    RETURNING id, template_id, title, description, position, days_before_start, created_at
  `;
  return NextResponse.json(item, { status: 201 });
}
