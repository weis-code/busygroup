import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const stage      = req.nextUrl.searchParams.get('stage');
  const companyId  = req.nextUrl.searchParams.get('company_id');
  const company     = req.nextUrl.searchParams.get('company'); // legacy slug filter, kept for back-compat
  const assignedTo = req.nextUrl.searchParams.get('assigned_to');
  const search      = req.nextUrl.searchParams.get('search');

  const candidates = await sql`
    SELECT c.id, c.full_name, c.email, c.phone, c.linkedin,
           c.applying_for, c.company_id, co.name AS company_name, co.color AS company_color,
           c.source, c.salary_expectation, c.location,
           c.stage, c.applied_at::text, c.interview_date, c.interview_format, c.interview_notes,
           c.start_date::text, c.notes, c.rejection_reason,
           c.hired_at, c.stopped_at,
           c.assigned_to, u.name AS assigned_to_name,
           c.created_at, c.updated_at,
           (SELECT COUNT(*) FROM hr_candidate_comments cc WHERE cc.candidate_id = c.id)::int AS comment_count,
           (SELECT COUNT(*) FROM recruitment_candidate_checklist cl WHERE cl.candidate_id = c.id)::int AS checklist_total,
           (SELECT COUNT(*) FROM recruitment_candidate_checklist cl WHERE cl.candidate_id = c.id AND cl.is_completed)::int AS checklist_done,
           (SELECT bool_or(cl.due_date < CURRENT_DATE AND NOT cl.is_completed) FROM recruitment_candidate_checklist cl WHERE cl.candidate_id = c.id) AS checklist_overdue,
           (CURRENT_DATE - COALESCE(
             (SELECT h.changed_at FROM recruitment_stage_history h WHERE h.candidate_id = c.id ORDER BY h.changed_at DESC LIMIT 1),
             c.updated_at
           )::date)::int AS days_in_stage
    FROM hr_candidates c
    LEFT JOIN companies co ON co.id = c.company_id
    LEFT JOIN users u ON u.id = c.assigned_to
    WHERE TRUE
      ${stage      ? sql`AND c.stage = ${stage}` : sql``}
      ${companyId  ? sql`AND c.company_id = ${companyId}` : sql``}
      ${company    ? sql`AND co.slug = ${company}` : sql``}
      ${assignedTo ? sql`AND c.assigned_to = ${assignedTo}` : sql``}
      ${search     ? sql`AND (c.full_name ILIKE ${'%' + search + '%'} OR c.email ILIKE ${'%' + search + '%'} OR c.applying_for ILIKE ${'%' + search + '%'})` : sql``}
    ORDER BY c.created_at DESC
  `;
  return NextResponse.json(candidates);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const {
    full_name, email, phone, linkedin, applying_for, company_id,
    source, salary_expectation, location, assigned_to,
    applied_at, interview_date, interview_format, start_date, notes,
  } = await req.json() as {
    full_name: string; email?: string; phone?: string; linkedin?: string;
    applying_for: string; company_id?: number | null;
    source?: string | null; salary_expectation?: string | null; location?: string | null;
    assigned_to?: string | null;
    applied_at?: string; interview_date?: string | null; interview_format?: string | null;
    start_date?: string | null; notes?: string;
  };

  if (!full_name?.trim() || !applying_for?.trim()) {
    return NextResponse.json({ error: 'Navn og stilling kræves' }, { status: 400 });
  }

  const [candidate] = await sql.begin(async tx => {
    const [c] = await tx`
      INSERT INTO hr_candidates
        (full_name, email, phone, linkedin, applying_for, company_id,
         source, salary_expectation, location, assigned_to,
         applied_at, interview_date, interview_format, start_date, notes, created_by)
      VALUES
        (${full_name.trim()}, ${email ?? null}, ${phone ?? null}, ${linkedin ?? null},
         ${applying_for.trim()}, ${company_id ?? null},
         ${source ?? null}, ${salary_expectation ?? null}, ${location ?? null}, ${assigned_to ?? null},
         ${applied_at ?? null}, ${interview_date ?? null}, ${interview_format ?? null}, ${start_date ?? null},
         ${notes ?? null}, ${session.id})
      RETURNING id, full_name, email, phone, linkedin, applying_for, company_id,
                source, salary_expectation, location, assigned_to,
                stage, applied_at::text, interview_date, interview_format, start_date::text, notes,
                created_at, updated_at
    `;
    await tx`
      INSERT INTO recruitment_stage_history (candidate_id, from_stage, to_stage, changed_by)
      VALUES (${c.id}, NULL, ${c.stage}, ${session.id})
    `;
    return [c];
  });

  return NextResponse.json(candidate, { status: 201 });
}
