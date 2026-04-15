import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = params;
    const body = await req.json() as { name?: string; color?: string };

    if (body.name !== undefined) {
      await sql`UPDATE crm_workspaces SET name = ${body.name.trim()} WHERE id = ${id}`;
    }
    if (body.color !== undefined) {
      await sql`UPDATE crm_workspaces SET color = ${body.color} WHERE id = ${id}`;
    }

    const [ws] = await sql`SELECT * FROM crm_workspaces WHERE id = ${id}`;
    if (!ws) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
    return NextResponse.json(ws);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = params;

    // Nullify workspace_id on all leads in this workspace
    await sql`UPDATE leads SET workspace_id = NULL WHERE workspace_id = ${id}`;

    // Delete the workspace
    await sql`DELETE FROM crm_workspaces WHERE id = ${id}`;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
