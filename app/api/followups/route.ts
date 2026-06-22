import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const followups = await sql`
    SELECT f.id, f.title, f.body, f.status, f.created_at, f.resolved_at,
           f.sitrep_id,
           cb.name AS created_by_name,
           au.name AS assigned_to_name, f.assigned_to,
           su.name AS seller_name,
           s.date::text AS sitrep_date,
           COALESCE(
             json_agg(
               json_build_object('id', c.id, 'body', c.body, 'user_name', cu.name, 'created_at', c.created_at)
               ORDER BY c.created_at
             ) FILTER (WHERE c.id IS NOT NULL),
             '[]'
           ) AS comments
    FROM followups f
    JOIN users cb ON cb.id = f.created_by
    LEFT JOIN users au ON au.id = f.assigned_to
    LEFT JOIN sitreps s ON s.id = f.sitrep_id
    LEFT JOIN users su ON su.id = s.user_id
    LEFT JOIN followup_comments c ON c.followup_id = f.id
    LEFT JOIN users cu ON cu.id = c.user_id
    GROUP BY f.id, cb.name, au.name, au.id, su.name, s.date
    ORDER BY
      CASE f.status WHEN 'OPEN' THEN 0 WHEN 'IN_PROGRESS' THEN 1 ELSE 2 END,
      f.created_at DESC
  `;

  const users = await sql`SELECT id, name FROM users WHERE role IN ('ADMIN','MANAGER') ORDER BY name`;

  return NextResponse.json({ followups, users });
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { title, body, sitrep_id, assigned_to } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: 'Titel kræves' }, { status: 400 });

  const [followup] = await sql`
    INSERT INTO followups (title, body, sitrep_id, assigned_to, created_by)
    VALUES (
      ${title.trim()},
      ${body?.trim() ?? null},
      ${sitrep_id ?? null},
      ${assigned_to ?? null},
      ${session.id}
    )
    RETURNING id, title, status, created_at
  `;

  return NextResponse.json(followup, { status: 201 });
}
