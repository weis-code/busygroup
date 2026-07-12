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
           c.stage, c.applied_at::text, c.interview_date,
           c.start_date::text, c.notes, c.created_at, c.updated_at,
           (CURRENT_DATE - c.updated_at::date)::int AS days_in_stage
    FROM hr_candidates c
    LEFT JOIN companies co ON co.id = c.company_id
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
  return NextResponse.json({ ...candidate, comments });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as {
    full_name?: string; email?: string | null; phone?: string | null; linkedin?: string | null;
    applying_for?: string; company_id?: number | null; stage?: string;
    applied_at?: string | null; interview_date?: string | null; start_date?: string | null; notes?: string | null;
  };

  const [updated] = await sql`
    UPDATE hr_candidates SET
      full_name       = COALESCE(${body.full_name ?? null}, full_name),
      email           = ${body.email !== undefined ? (body.email ?? null) : sql`email`},
      phone           = ${body.phone !== undefined ? (body.phone ?? null) : sql`phone`},
      linkedin        = ${body.linkedin !== undefined ? (body.linkedin ?? null) : sql`linkedin`},
      applying_for    = COALESCE(${body.applying_for ?? null}, applying_for),
      company_id      = ${body.company_id !== undefined ? (body.company_id ?? null) : sql`company_id`},
      stage           = COALESCE(${body.stage ?? null}, stage),
      applied_at      = COALESCE(${body.applied_at ?? null}::date, applied_at),
      interview_date  = ${body.interview_date !== undefined ? (body.interview_date ?? null) : sql`interview_date`},
      start_date      = ${body.start_date !== undefined ? (body.start_date ?? null) : sql`start_date`},
      notes           = ${body.notes !== undefined ? (body.notes ?? null) : sql`notes`},
      updated_at      = NOW()
    WHERE id = ${params.id}
    RETURNING id, full_name, email, phone, linkedin, applying_for, company_id, stage,
              applied_at::text, interview_date, start_date::text, notes, updated_at
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
