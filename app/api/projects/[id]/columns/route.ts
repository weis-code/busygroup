import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

// POST — add column
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const { name, color = '#334455' } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Navn er påkrævet' }, { status: 400 });

  const [last] = await sql`SELECT MAX(position) AS pos FROM project_columns WHERE board_id = ${params.id}`;
  const position = (Number((last as unknown as { pos: number | null }).pos ?? -1)) + 1;

  const id  = randomUUID();
  const now = new Date().toISOString();
  await sql`
    INSERT INTO project_columns (id, board_id, name, position, color, created_at)
    VALUES (${id}, ${params.id}, ${name.trim()}, ${position}, ${color}, ${now})
  `;

  return NextResponse.json({ id, name: name.trim(), position, color, board_id: params.id }, { status: 201 });
}
