import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

// GET — stadier for et specifikt workspace (?workspace=internal eller ?workspace=<id>)
export async function GET(req: NextRequest) {
  const workspace = req.nextUrl.searchParams.get('workspace') ?? 'internal';

  const stages = workspace === 'internal'
    ? await sql`SELECT pk, id, label, position FROM pipeline_stages WHERE workspace_id IS NULL ORDER BY position ASC`
    : await sql`SELECT pk, id, label, position FROM pipeline_stages WHERE workspace_id = ${workspace} ORDER BY position ASC`;

  return NextResponse.json(stages);
}

// POST — opret nyt stadie (kun admin)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 });
  }

  const { label, workspace } = await req.json() as { label?: string; workspace?: string };
  if (!label?.trim()) return NextResponse.json({ error: 'Label er påkrævet' }, { status: 400 });

  const workspaceId = (!workspace || workspace === 'internal') ? null : workspace;

  // Generate a slug-like ID
  const slug = label.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Ensure slug is unique within this workspace
  const existing = workspaceId
    ? await sql`SELECT pk FROM pipeline_stages WHERE id = ${slug} AND workspace_id = ${workspaceId}`
    : await sql`SELECT pk FROM pipeline_stages WHERE id = ${slug} AND workspace_id IS NULL`;
  const id = existing.length > 0 ? `${slug}-${randomUUID().slice(0, 6)}` : slug;

  // Insert at end of this workspace's pipeline
  const maxposResult = workspaceId
    ? await sql`SELECT COALESCE(MAX(position), -1) as maxpos FROM pipeline_stages WHERE workspace_id = ${workspaceId}`
    : await sql`SELECT COALESCE(MAX(position), -1) as maxpos FROM pipeline_stages WHERE workspace_id IS NULL`;
  const maxpos = Number((maxposResult as unknown as Array<{ maxpos: number }>)[0].maxpos);

  const pk = randomUUID();
  const now = new Date().toISOString();

  const [stage] = workspaceId
    ? await sql`INSERT INTO pipeline_stages (pk, id, label, position, workspace_id, created_at) VALUES (${pk}, ${id}, ${label.trim()}, ${maxpos + 1}, ${workspaceId}, ${now}) RETURNING pk, id, label, position`
    : await sql`INSERT INTO pipeline_stages (pk, id, label, position, workspace_id, created_at) VALUES (${pk}, ${id}, ${label.trim()}, ${maxpos + 1}, NULL, ${now}) RETURNING pk, id, label, position`;

  return NextResponse.json(stage, { status: 201 });
}
