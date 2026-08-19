import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [candidate] = await sql`
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
    WHERE c.id = ${params.id}
  `;
  if (!candidate) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  const comments = await sql`
    SELECT cc.id, cc.candidate_id, cc.author_id, u.name AS author_name, cc.body, cc.created_at, cc.updated_at
    FROM hr_candidate_comments cc
    LEFT JOIN users u ON u.id = cc.author_id
    WHERE cc.candidate_id = ${params.id}
    ORDER BY cc.created_at ASC
  `;

  const checklist = await sql`
    SELECT id, candidate_id, template_item_id, title, is_completed, completed_at,
           completed_by, u.name AS completed_by_name, due_date::text, position
    FROM recruitment_candidate_checklist cl
    LEFT JOIN users u ON u.id = cl.completed_by
    WHERE cl.candidate_id = ${params.id}
    ORDER BY cl.is_completed ASC, cl.position ASC, cl.id ASC
  `;

  const stage_history = await sql`
    SELECT h.id, h.from_stage, h.to_stage, h.changed_by, u.name AS changed_by_name, h.changed_at
    FROM recruitment_stage_history h
    LEFT JOIN users u ON u.id = h.changed_by
    WHERE h.candidate_id = ${params.id}
    ORDER BY h.changed_at ASC
  `;

  return NextResponse.json({ ...candidate, comments, checklist, stage_history });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as {
    full_name?: string; email?: string | null; phone?: string | null; linkedin?: string | null;
    applying_for?: string; company_id?: number | null;
    source?: string | null; salary_expectation?: string | null; location?: string | null;
    assigned_to?: string | null;
    applied_at?: string | null; interview_date?: string | null; interview_format?: string | null;
    interview_notes?: string | null;
    start_date?: string | null; notes?: string | null; rejection_reason?: string | null;
  };
  // NOTE: `stage` is intentionally not accepted here — stage changes must go through
  // PATCH /api/hr/candidates/[id]/stage so recruitment_stage_history stays accurate.

  const [updated] = await sql`
    UPDATE hr_candidates SET
      full_name          = COALESCE(${body.full_name ?? null}, full_name),
      email              = ${body.email !== undefined ? (body.email ?? null) : sql`email`},
      phone              = ${body.phone !== undefined ? (body.phone ?? null) : sql`phone`},
      linkedin           = ${body.linkedin !== undefined ? (body.linkedin ?? null) : sql`linkedin`},
      applying_for       = COALESCE(${body.applying_for ?? null}, applying_for),
      company_id         = ${body.company_id !== undefined ? (body.company_id ?? null) : sql`company_id`},
      source             = ${body.source !== undefined ? (body.source ?? null) : sql`source`},
      salary_expectation = ${body.salary_expectation !== undefined ? (body.salary_expectation ?? null) : sql`salary_expectation`},
      location           = ${body.location !== undefined ? (body.location ?? null) : sql`location`},
      assigned_to        = ${body.assigned_to !== undefined ? (body.assigned_to ?? null) : sql`assigned_to`},
      applied_at         = COALESCE(${body.applied_at ?? null}::date, applied_at),
      interview_date     = ${body.interview_date !== undefined ? (body.interview_date ?? null) : sql`interview_date`},
      interview_format   = ${body.interview_format !== undefined ? (body.interview_format ?? null) : sql`interview_format`},
      interview_notes    = ${body.interview_notes !== undefined ? (body.interview_notes ?? null) : sql`interview_notes`},
      start_date         = ${body.start_date !== undefined ? (body.start_date ?? null) : sql`start_date`},
      notes              = ${body.notes !== undefined ? (body.notes ?? null) : sql`notes`},
      rejection_reason   = ${body.rejection_reason !== undefined ? (body.rejection_reason ?? null) : sql`rejection_reason`},
      updated_at         = NOW()
    WHERE id = ${params.id}
    RETURNING id, full_name, email, phone, linkedin, applying_for, company_id,
              source, salary_expectation, location, assigned_to,
              stage, applied_at::text, interview_date, interview_format, interview_notes,
              start_date::text, notes, rejection_reason, updated_at
  `;
  if (!updated) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await sql`DELETE FROM hr_candidates WHERE id = ${params.id}`;
  return NextResponse.json({ ok: true });
}
