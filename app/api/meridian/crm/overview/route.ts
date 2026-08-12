import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Personal CRM: everyone below ADMIN sees only their own pipeline stats;
  // ADMIN (the owner) sees the whole Meridian team's combined.
  const ownerFilter    = session.role === 'ADMIN' ? sql`` : sql`AND d.owner_id = ${session.id}`;
  const ownerFilterT   = session.role === 'ADMIN' ? sql`` : sql`AND t.owner_id = ${session.id}`;
  const stagesOwnerFilter = session.role === 'ADMIN' ? sql`` : sql`AND s.owner_id = ${session.id}`;

  const today      = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';
  const weekStart  = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const leadsByStage = await sql`
    SELECT
      s.id, s.label AS name, s.color, s.probability, s.is_won, s.is_lost, s.position,
      COUNT(d.id)::int AS lead_count,
      COALESCE(SUM(d.value), 0)::int AS total_value
    FROM crm_pipeline_stages s
    LEFT JOIN crm_deals d ON d.stage_id = s.id ${ownerFilter}
    WHERE s.workspace_id = (SELECT id FROM companies WHERE slug = 'meridian')
      ${stagesOwnerFilter}
    GROUP BY s.id, s.label, s.color, s.probability, s.is_won, s.is_lost, s.position
    ORDER BY s.position
  `;

  const [pipeline] = await sql`
    SELECT
      COALESCE(SUM(d.value), 0)::int AS pipeline_value,
      COALESCE(SUM(d.value * d.probability / 100), 0)::int AS weighted_pipeline
    FROM crm_deals d
    JOIN crm_pipeline_stages s ON s.id = d.stage_id
    WHERE d.workspace_id = (SELECT id FROM companies WHERE slug = 'meridian')
      AND NOT s.is_won AND NOT s.is_lost
      ${ownerFilter}
  `;

  const [wonMonth] = await sql`
    SELECT COUNT(*)::int AS count, COALESCE(SUM(value), 0)::int AS value
    FROM crm_deals d
    WHERE d.workspace_id = (SELECT id FROM companies WHERE slug = 'meridian')
      AND d.won_at >= ${monthStart}::date
      ${ownerFilter}
  `;

  const [activitiesWeek] = await sql`
    SELECT COUNT(*)::int AS count
    FROM crm_touchpoints t
    JOIN crm_deals d ON d.id = t.deal_id
    WHERE d.workspace_id = (SELECT id FROM companies WHERE slug = 'meridian')
      AND t.occurred_at >= ${weekStart}::timestamptz
      ${ownerFilterT}
  `;

  const nextActions = await sql`
    SELECT d.id AS lead_id, d.prospect_company AS company_name, t.next_action, t.next_action_date::text, t.type
    FROM crm_touchpoints t
    JOIN crm_deals d ON d.id = t.deal_id
    WHERE d.workspace_id = (SELECT id FROM companies WHERE slug = 'meridian')
      AND t.next_action_date IS NOT NULL
      AND t.next_action IS NOT NULL
      AND t.next_action_done = FALSE
      ${ownerFilterT}
    ORDER BY t.next_action_date ASC
    LIMIT 20
  `;

  return NextResponse.json({
    leadsByStage,
    pipelineValue:    pipeline.pipeline_value,
    weightedPipeline: pipeline.weighted_pipeline,
    wonThisMonth:     { count: wonMonth.count, value: wonMonth.value },
    activitiesThisWeek: activitiesWeek.count,
    nextActions,
  });
}
