import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sitreps = await sql`
    SELECT s.id, s.date::text, s.went_well, s.challenges, s.needs_help,
           s.is_support_request, s.created_at,
           COALESCE(
             json_agg(
               json_build_object('id', r.id, 'body', r.body, 'user_name', u.name, 'created_at', r.created_at)
               ORDER BY r.created_at
             ) FILTER (WHERE r.id IS NOT NULL),
             '[]'
           ) AS replies
    FROM sitreps s
    LEFT JOIN sitrep_replies r ON r.sitrep_id = s.id
    LEFT JOIN users u ON u.id = r.user_id
    WHERE s.user_id = ${session.id}
    GROUP BY s.id
    ORDER BY s.date DESC
    LIMIT 30
  `;

  const today = new Date().toISOString().slice(0, 10);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const todaySitrep = (sitreps as any[]).find((s: { date: string }) => s.date === today) ?? null;

  return NextResponse.json({ sitreps, todaySitrep });
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { went_well, challenges, needs_help, is_support_request, date } = await req.json();
  const sDate = date || new Date().toISOString().slice(0, 10);

  const [sitrep] = await sql`
    INSERT INTO sitreps (user_id, date, went_well, challenges, needs_help, is_support_request)
    VALUES (${session.id}, ${sDate}, ${went_well ?? null}, ${challenges ?? null}, ${needs_help ?? null}, ${!!is_support_request})
    ON CONFLICT (user_id, date) DO UPDATE SET
      went_well = EXCLUDED.went_well,
      challenges = EXCLUDED.challenges,
      needs_help = EXCLUDED.needs_help,
      is_support_request = EXCLUDED.is_support_request
    RETURNING id, date::text
  `;

  return NextResponse.json(sitrep, { status: 201 });
}
