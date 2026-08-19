import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';
import { STAGES, FUNNEL_STAGES } from '@/lib/recruitment';

export const dynamic = 'force-dynamic';

// Hardcoded rank of each funnel stage — mirrors FUNNEL_STAGES from lib/recruitment.
// Used to determine "reached stage X or later" per candidate for funnel/conversion math.
const STAGE_RANK_SQL = sql`
  CASE to_stage
    WHEN 'ansøgt' THEN 0
    WHEN 'screening' THEN 1
    WHEN 'samtale_booket' THEN 2
    WHEN 'samtale_afholdt' THEN 3
    WHEN 'opfølgning' THEN 4
    WHEN 'tilbud_sendt' THEN 5
    WHEN 'ansat' THEN 6
    ELSE NULL
  END
`;

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const toParam = req.nextUrl.searchParams.get('to');
  const fromParam = req.nextUrl.searchParams.get('from');
  const to = toParam ?? new Date().toISOString().slice(0, 10);
  const from = fromParam ?? new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const periodDays = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000));
  const prevTo = new Date(new Date(from).getTime() - 1).toISOString().slice(0, 10);
  const prevFrom = new Date(new Date(from).getTime() - periodDays * 86400000).toISOString().slice(0, 10);

  // Candidates whose pipeline entry (first stage_history row) falls within the period —
  // this is the cohort used for funnel/conversion math.
  const cohort = await sql`
    SELECT c.id, MAX(${STAGE_RANK_SQL}) AS max_rank
    FROM hr_candidates c
    JOIN recruitment_stage_history h ON h.candidate_id = c.id
    WHERE c.id IN (
      SELECT candidate_id FROM recruitment_stage_history
      WHERE from_stage IS NULL AND changed_at::date BETWEEN ${from} AND ${to}
    )
    GROUP BY c.id
  `;
  const cohortSize = cohort.length;
  const reached = (rank: number) => cohort.filter(c => (c.max_rank ?? -1) >= rank).length;

  const [{ count: total_applications }] = await sql`
    SELECT COUNT(*)::int AS count FROM hr_candidates WHERE applied_at BETWEEN ${from} AND ${to}
  `;
  const [{ count: total_applications_prev }] = await sql`
    SELECT COUNT(*)::int AS count FROM hr_candidates WHERE applied_at BETWEEN ${prevFrom} AND ${prevTo}
  `;

  const by_stage_rows = await sql`SELECT stage, COUNT(*)::int AS count FROM hr_candidates GROUP BY stage`;
  const by_stage = Object.fromEntries(STAGES.map(s => [s.key, by_stage_rows.find(r => r.stage === s.key)?.count ?? 0]));

  const [{ count: hired_count }] = await sql`
    SELECT COUNT(*)::int AS count FROM recruitment_stage_history
    WHERE to_stage = 'ansat' AND changed_at::date BETWEEN ${from} AND ${to}
  `;
  const [{ count: stopped_count }] = await sql`
    SELECT COUNT(*)::int AS count FROM recruitment_stage_history
    WHERE to_stage = 'stoppet' AND changed_at::date BETWEEN ${from} AND ${to}
  `;

  const [retention30] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE hired_at <= NOW() - INTERVAL '30 days')::int AS eligible,
      COUNT(*) FILTER (
        WHERE hired_at <= NOW() - INTERVAL '30 days'
        AND (stopped_at IS NULL OR stopped_at > hired_at + INTERVAL '30 days')
      )::int AS retained
    FROM hr_candidates WHERE hired_at::date BETWEEN ${from} AND ${to}
  `;
  const [retention90] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE hired_at <= NOW() - INTERVAL '90 days')::int AS eligible,
      COUNT(*) FILTER (
        WHERE hired_at <= NOW() - INTERVAL '90 days'
        AND (stopped_at IS NULL OR stopped_at > hired_at + INTERVAL '90 days')
      )::int AS retained
    FROM hr_candidates WHERE hired_at::date BETWEEN ${from} AND ${to}
  `;

  const [{ avg_days }] = await sql`
    SELECT AVG(hired_at::date - applied_at)::float AS avg_days
    FROM hr_candidates WHERE hired_at::date BETWEEN ${from} AND ${to}
  `;

  const stageDurationRows = await sql`
    SELECT to_stage, AVG(EXTRACT(EPOCH FROM (next_changed_at - changed_at)) / 86400.0)::float AS avg_days
    FROM (
      SELECT to_stage, changed_at,
             LEAD(changed_at) OVER (PARTITION BY candidate_id ORDER BY changed_at) AS next_changed_at
      FROM recruitment_stage_history
    ) sub
    WHERE next_changed_at IS NOT NULL AND to_stage = ANY(${FUNNEL_STAGES.slice(0, -1)})
    GROUP BY to_stage
  `;
  const avg_days_per_stage = FUNNEL_STAGES.slice(0, -1).map((key, i) => {
    const row = stageDurationRows.find(r => r.to_stage === key);
    const nextLabel = STAGES.find(s => s.key === FUNNEL_STAGES[i + 1])?.label ?? FUNNEL_STAGES[i + 1];
    return {
      stage: key,
      label: `${STAGES.find(s => s.key === key)?.label ?? key} → ${nextLabel}`,
      avg_days: row?.avg_days ?? null,
    };
  });

  const by_source_rows = await sql`
    SELECT COALESCE(source, 'ukendt') AS source, COUNT(*)::int AS count,
           COUNT(*) FILTER (WHERE stage = 'ansat')::int AS hired
    FROM hr_candidates WHERE applied_at BETWEEN ${from} AND ${to}
    GROUP BY source
  `;
  const by_source = by_source_rows.map(r => ({
    source: r.source, count: r.count, hired: r.hired,
    hire_rate: r.count > 0 ? r.hired / r.count : 0,
  }));

  const by_company_rows = await sql`
    SELECT c.company_id, co.name AS company_name, COUNT(*)::int AS count,
           COUNT(*) FILTER (WHERE c.stage = 'ansat')::int AS hired
    FROM hr_candidates c
    LEFT JOIN companies co ON co.id = c.company_id
    WHERE c.applied_at BETWEEN ${from} AND ${to}
    GROUP BY c.company_id, co.name
  `;
  const by_company = by_company_rows.map(r => ({
    company_id: r.company_id, company_name: r.company_name ?? 'Intet firma', count: r.count, hired: r.hired,
    hire_rate: r.count > 0 ? r.hired / r.count : 0,
  }));

  const upcoming_starts = await sql`
    SELECT c.id, c.full_name, c.applying_for, c.company_id, co.name AS company_name, co.color AS company_color,
           c.start_date::text,
           (SELECT COUNT(*)::int FROM recruitment_candidate_checklist cl WHERE cl.candidate_id = c.id) AS checklist_total,
           (SELECT COUNT(*)::int FROM recruitment_candidate_checklist cl WHERE cl.candidate_id = c.id AND cl.is_completed) AS checklist_done
    FROM hr_candidates c
    LEFT JOIN companies co ON co.id = c.company_id
    WHERE c.start_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
    ORDER BY c.start_date ASC
  `;

  const funnel = FUNNEL_STAGES.map((key, i) => {
    const count = reached(i);
    const prevCount = i === 0 ? cohortSize : reached(i - 1);
    const dropoff = i === 0 ? 0 : prevCount - count;
    const dropoffPct = prevCount > 0 ? dropoff / prevCount : 0;
    return {
      stage: key,
      label: STAGES.find(s => s.key === key)?.label ?? key,
      count,
      pct_of_total: cohortSize > 0 ? count / cohortSize : 0,
      dropoff,
      dropoff_pct: dropoffPct,
    };
  });

  const application_to_interview = cohortSize > 0 ? reached(2) / cohortSize : 0;
  const application_to_offer = cohortSize > 0 ? reached(5) / cohortSize : 0;
  const application_to_hire = cohortSize > 0 ? reached(6) / cohortSize : 0;
  const interview_count = reached(2);
  const offer_count = reached(5);
  const samtale_to_tilbud = interview_count > 0 ? offer_count / interview_count : 0;
  const tilbud_to_ansat = offer_count > 0 ? reached(6) / offer_count : 0;

  return NextResponse.json({
    from, to,
    total_applications, total_applications_prev,
    by_stage,
    hired_count, stopped_count,
    conversion_rates: {
      application_to_interview,
      application_to_offer,
      application_to_hire,
      samtale_to_tilbud,
      tilbud_to_ansat,
      hire_retention_30d: retention30.eligible > 0 ? retention30.retained / retention30.eligible : null,
      hire_retention_90d: retention90.eligible > 0 ? retention90.retained / retention90.eligible : null,
    },
    avg_days_to_hire: avg_days,
    avg_days_per_stage,
    by_source,
    by_company,
    upcoming_starts,
    funnel,
    cohort_size: cohortSize,
  });
}
