import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const stage   = req.nextUrl.searchParams.get('stage');
  const company = req.nextUrl.searchParams.get('company');

  const candidates = await sql`
    SELECT c.id, c.full_name, c.email, c.phone, c.linkedin,
           c.applying_for, c.company_id, co.name AS company_name, co.color AS company_color,
           c.stage, c.applied_at::text, c.interview_date,
           c.start_date::text, c.notes, c.created_at, c.updated_at,
           (SELECT COUNT(*) FROM hr_candidate_comments cc WHERE cc.candidate_id = c.id)::int AS comment_count,
           (CURRENT_DATE - c.updated_at::date)::int AS days_in_stage
    FROM hr_candidates c
    LEFT JOIN companies co ON co.id = c.company_id
    WHERE TRUE
      ${stage   ? sql`AND c.stage = ${stage}` : sql``}
      ${company ? sql`AND co.slug = ${company}` : sql``}
    ORDER BY c.created_at DESC
  `;
  return NextResponse.json(candidates);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { full_name, email, phone, linkedin, applying_for, company_id, applied_at, interview_date, start_date, notes } = await req.json() as {
    full_name: string; email?: string; phone?: string; linkedin?: string;
    applying_for: string; company_id?: number | null;
    applied_at?: string; interview_date?: string | null; start_date?: string | null; notes?: string;
  };

  if (!full_name?.trim() || !applying_for?.trim()) {
    return NextResponse.json({ error: 'Navn og stilling kræves' }, { status: 400 });
  }

  const [candidate] = await sql`
    INSERT INTO hr_candidates
      (full_name, email, phone, linkedin, applying_for, company_id, applied_at, interview_date, start_date, notes, created_by)
    VALUES
      (${full_name.trim()}, ${email ?? null}, ${phone ?? null}, ${linkedin ?? null},
       ${applying_for.trim()}, ${company_id ?? null},
       ${applied_at ?? null}, ${interview_date ?? null}, ${start_date ?? null},
       ${notes ?? null}, ${session.id})
    RETURNING id, full_name, email, phone, linkedin, applying_for, company_id, stage,
              applied_at::text, interview_date, start_date::text, notes, created_at, updated_at
  `;
  return NextResponse.json(candidate, { status: 201 });
}
