import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

async function getManagerId(userId: string): Promise<number | null> {
  const [row] = await sql`SELECT id FROM nlca_managers WHERE user_id = ${userId} LIMIT 1`;
  return row?.id ?? null;
}

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || (session.role !== 'ADMIN' && session.role !== 'NLCA_MANAGER')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (session.role === 'NLCA_MANAGER') {
    const managerId = await getManagerId(session.id);
    if (!managerId) return NextResponse.json([]);

    const creators = await sql`
      SELECT c.id, c.name, c.tiktok_handle, c.is_active, c.created_at,
             m.id AS manager_id, m.name AS manager_name
      FROM nlca_creators c
      LEFT JOIN nlca_managers m ON m.id = c.manager_id
      WHERE c.manager_id = ${managerId}
      ORDER BY c.name ASC
    `;
    return NextResponse.json(creators);
  }

  const creators = await sql`
    SELECT c.id, c.name, c.tiktok_handle, c.is_active, c.created_at,
           m.id AS manager_id, m.name AS manager_name
    FROM nlca_creators c
    LEFT JOIN nlca_managers m ON m.id = c.manager_id
    ORDER BY c.name ASC
  `;
  return NextResponse.json(creators);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { name, tiktok_handle, manager_id, notes } = await req.json() as {
    name: string;
    tiktok_handle?: string;
    manager_id?: number;
    notes?: string;
  };
  if (!name) return NextResponse.json({ error: 'Navn kræves' }, { status: 400 });

  const [creator] = await sql`
    INSERT INTO nlca_creators (name, tiktok_handle, manager_id, notes)
    VALUES (${name}, ${tiktok_handle ?? null}, ${manager_id ?? null}, ${notes ?? null})
    RETURNING id, name, tiktok_handle, manager_id, notes, is_active, created_at
  `;
  return NextResponse.json(creator, { status: 201 });
}
