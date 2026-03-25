export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const rows = await sql`
      SELECT * FROM customer_notes WHERE customer_id = ${params.id} ORDER BY created_at DESC
    `;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { content, created_by = 'human' } = await req.json();
    if (!content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 });
    const id = randomUUID();
    const now = new Date().toISOString();
    await sql`
      INSERT INTO customer_notes (id, customer_id, content, created_by, created_at)
      VALUES (${id}, ${params.id}, ${content}, ${created_by}, ${now})
    `;
    const notes = await sql`SELECT * FROM customer_notes WHERE customer_id = ${params.id} ORDER BY created_at DESC`;
    return NextResponse.json(notes);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
