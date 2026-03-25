import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const now = new Date().toISOString();
    const id = randomUUID();

    await sql`
      INSERT INTO notes (id, lead_id, content, created_by, created_at)
      VALUES (${id}, ${params.id}, ${body.content}, ${body.created_by || 'human'}, ${now})
    `;

    const [note] = await sql`SELECT * FROM notes WHERE id = ${id}`;
    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
