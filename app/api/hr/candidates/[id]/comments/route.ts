import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const comments = await sql`
    SELECT cc.id, cc.candidate_id, cc.author_id, u.name AS author_name, cc.body, cc.created_at, cc.updated_at
    FROM hr_candidate_comments cc
    LEFT JOIN users u ON u.id = cc.author_id
    WHERE cc.candidate_id = ${params.id}
    ORDER BY cc.created_at ASC
  `;
  return NextResponse.json(comments);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { body } = await req.json() as { body: string };
  if (!body?.trim()) return NextResponse.json({ error: 'Kommentar kræves' }, { status: 400 });

  const [comment] = await sql`
    INSERT INTO hr_candidate_comments (candidate_id, author_id, body)
    VALUES (${params.id}, ${session.id}, ${body.trim()})
    RETURNING id, candidate_id, author_id, body, created_at, updated_at
  `;
  return NextResponse.json({ ...comment, author_name: session.name }, { status: 201 });
}
