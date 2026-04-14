import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

// GET — alle pipeline-stadier sorteret efter position
export async function GET() {
  const stages = await sql`
    SELECT id, label, position FROM pipeline_stages ORDER BY position ASC
  `;
  return NextResponse.json(stages);
}

// POST — opret nyt stadie (kun admin)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 });
  }

  const { label } = await req.json() as { label?: string };
  if (!label?.trim()) return NextResponse.json({ error: 'Label er påkrævet' }, { status: 400 });

  // Generate a slug-like ID from the label
  const slug = label.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Ensure uniqueness
  const existing = await sql`SELECT id FROM pipeline_stages WHERE id = ${slug}`;
  const id = existing.length > 0 ? `${slug}-${randomUUID().slice(0, 6)}` : slug;

  // Insert at end
  const [{ maxpos }] = await sql`SELECT COALESCE(MAX(position), -1) as maxpos FROM pipeline_stages` as unknown as Array<{ maxpos: number }>;
  const now = new Date().toISOString();

  const [stage] = await sql`
    INSERT INTO pipeline_stages (id, label, position, created_at)
    VALUES (${id}, ${label.trim()}, ${maxpos + 1}, ${now})
    RETURNING id, label, position
  `;

  return NextResponse.json(stage, { status: 201 });
}
