import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { taskId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const comments = await sql`
    SELECT pc.*, u.name AS user_name
    FROM project_task_comments pc
    JOIN users u ON pc.user_id = u.id
    WHERE pc.task_id = ${params.taskId}
    ORDER BY pc.created_at ASC
  `;
  return NextResponse.json(comments);
}

export async function POST(req: NextRequest, { params }: { params: { taskId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: 'Indhold er påkrævet' }, { status: 400 });

  const id  = randomUUID();
  const now = new Date().toISOString();
  await sql`
    INSERT INTO project_task_comments (id, task_id, user_id, content, created_at)
    VALUES (${id}, ${params.taskId}, ${session.id}, ${content.trim()}, ${now})
  `;

  const [comment] = await sql`
    SELECT pc.*, u.name AS user_name FROM project_task_comments pc
    JOIN users u ON pc.user_id = u.id WHERE pc.id = ${id}
  `;
  return NextResponse.json(comment, { status: 201 });
}
