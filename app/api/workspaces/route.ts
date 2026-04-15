import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const workspaces = await sql`SELECT * FROM crm_workspaces ORDER BY created_at ASC` as unknown as Array<{ id: string; name: string; color: string; created_by: string; created_at: string }>;
    return NextResponse.json(workspaces);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { name, color } = body;
    if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const id = randomUUID();
    const now = new Date().toISOString();

    await sql`
      INSERT INTO crm_workspaces (id, name, color, created_by, created_at)
      VALUES (${id}, ${name.trim()}, ${color || '#3498DB'}, ${session.id}, ${now})
    `;

    // Copy internal pipeline stages to this new workspace
    const internalStages = await sql`
      SELECT id, label, position FROM pipeline_stages WHERE workspace_id IS NULL ORDER BY position ASC
    ` as unknown as Array<{ id: string; label: string; position: number }>;
    for (const s of internalStages) {
      await sql`
        INSERT INTO pipeline_stages (pk, id, label, position, workspace_id, created_at)
        VALUES (gen_random_uuid()::text, ${s.id}, ${s.label}, ${s.position}, ${id}, ${now})
      `.catch(() => {});
    }

    const [workspace] = await sql`SELECT * FROM crm_workspaces WHERE id = ${id}` as unknown as Array<{ id: string; name: string; color: string; created_by: string; created_at: string }>;
    return NextResponse.json(workspace, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
