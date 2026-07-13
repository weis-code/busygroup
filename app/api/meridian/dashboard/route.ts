import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const today     = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';
  const lastMonth  = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7) + '-01';
  const lastMonthEnd = today.slice(0, 7) + '-01';

  // Meridian company id
  const [meridianCo] = await sql`SELECT id FROM companies WHERE slug = 'meridian'`;
  const meridianId: number | null = meridianCo?.id ?? null;

  // MRR — active customer_products for meridian customers
  const [mrrRow] = await sql`
    SELECT COALESCE(SUM(cp.price_dkk), 0)::int AS mrr
    FROM customer_products cp
    JOIN customers cu ON cu.id = cp.customer_id
    WHERE cu.company_id = ${meridianId} AND cp.status = 'active'
  `;

  const [lastMrrRow] = await sql`
    SELECT COALESCE(SUM(cp.price_dkk), 0)::int AS mrr
    FROM customer_products cp
    JOIN customers cu ON cu.id = cp.customer_id
    WHERE cu.company_id = ${meridianId}
      AND cp.status = 'active'
      AND cp.started_at < ${lastMonthEnd}
  `;

  const [subCount] = await sql`
    SELECT COUNT(*)::int AS count FROM customer_products cp
    JOIN customers cu ON cu.id = cp.customer_id
    WHERE cu.company_id = ${meridianId} AND cp.status = 'active'
  `;

  // Customers
  const [custRow] = await sql`
    SELECT COUNT(*)::int AS count
    FROM customers WHERE company_id = ${meridianId} AND status = 'active'
  `;
  const [onboardRow] = await sql`
    SELECT COUNT(*)::int AS count
    FROM customers WHERE company_id = ${meridianId} AND status = 'onboarding'
  `;
  const [newCustRow] = await sql`
    SELECT COUNT(*)::int AS count
    FROM customers WHERE company_id = ${meridianId}
      AND status = 'active' AND created_at >= ${monthStart}
  `;

  // Recent customers this month
  const recentCustomers = await sql`
    SELECT cu.id, cu.name, cu.status, cu.created_at,
      COALESCE(SUM(cp.price_dkk) FILTER (WHERE cp.status='active'), 0)::int AS mrr,
      ARRAY_AGG(DISTINCT cp.product_name) FILTER (WHERE cp.product_name IS NOT NULL) AS products
    FROM customers cu
    LEFT JOIN customer_products cp ON cp.customer_id = cu.id
    WHERE cu.company_id = ${meridianId} AND cu.created_at >= ${monthStart}
    GROUP BY cu.id ORDER BY cu.created_at DESC LIMIT 5
  `;

  // Support tickets
  const [openRow]    = await sql`SELECT COUNT(*)::int AS count FROM meridian_tickets WHERE status = 'open'`;
  const [awaitRow]   = await sql`SELECT COUNT(*)::int AS count FROM meridian_tickets WHERE status = 'awaiting_customer'`;
  const [resolvedToday] = await sql`
    SELECT COUNT(*)::int AS count FROM meridian_tickets
    WHERE status = 'resolved' AND resolved_at::date = CURRENT_DATE
  `;

  const openTickets = await sql`
    SELECT id, customer_name, subject, status, created_at
    FROM meridian_tickets
    WHERE status NOT IN ('resolved','closed')
    ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, created_at DESC
    LIMIT 5
  `;

  // Pipeline (owner = current user)
  const [pipelineRow] = await sql`
    SELECT
      COALESCE(SUM(l.deal_value_dkk * s.probability / 100.0), 0)::int AS weighted_pipeline,
      COUNT(*) FILTER (WHERE NOT s.is_won AND NOT s.is_lost)::int AS active_leads
    FROM meridian_leads l
    JOIN meridian_pipeline_stages s ON s.id = l.stage_id
    WHERE l.owner_id = ${session.id}
  `;

  const [wonRow] = await sql`
    SELECT COUNT(*)::int AS count, COALESCE(SUM(l.deal_value_dkk), 0)::int AS value
    FROM meridian_leads l
    JOIN meridian_pipeline_stages s ON s.id = l.stage_id
    WHERE l.owner_id = ${session.id} AND s.is_won
      AND l.won_at >= ${monthStart}
  `;

  // Pipeline by stage
  const pipelineByStage = await sql`
    SELECT s.id, s.name, s.color, s.position,
      COUNT(l.id)::int AS lead_count,
      COALESCE(SUM(l.deal_value_dkk), 0)::int AS total_value
    FROM meridian_pipeline_stages s
    LEFT JOIN meridian_leads l ON l.stage_id = s.id AND l.owner_id = ${session.id}
    WHERE s.owner_id = ${session.id} AND NOT s.is_won AND NOT s.is_lost
    GROUP BY s.id ORDER BY s.position
  `;

  // Next actions
  const nextActions = await sql`
    SELECT DISTINCT ON (l.id)
      l.id AS lead_id, l.company_name, a.next_action, a.next_action_date, a.type
    FROM meridian_lead_activities a
    JOIN meridian_leads l ON l.id = a.lead_id
    WHERE a.owner_id = ${session.id}
      AND a.next_action_date IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM meridian_pipeline_stages s WHERE s.id = l.stage_id AND (s.is_won OR s.is_lost)
      )
    ORDER BY l.id, a.next_action_date ASC
  `;

  return NextResponse.json({
    mrr:              Number(mrrRow?.mrr ?? 0),
    lastMrr:          Number(lastMrrRow?.mrr ?? 0),
    subCount:         Number(subCount?.count ?? 0),
    customers:        Number(custRow?.count ?? 0),
    onboarding:       Number(onboardRow?.count ?? 0),
    newCustomers:     Number(newCustRow?.count ?? 0),
    recentCustomers,
    openTickets:      Number(openRow?.count ?? 0),
    awaitingTickets:  Number(awaitRow?.count ?? 0),
    resolvedToday:    Number(resolvedToday?.count ?? 0),
    latestOpenTickets: openTickets,
    weightedPipeline: Number(pipelineRow?.weighted_pipeline ?? 0),
    activeLeads:      Number(pipelineRow?.active_leads ?? 0),
    wonThisMonth:     { count: Number(wonRow?.count ?? 0), value: Number(wonRow?.value ?? 0) },
    pipelineByStage,
    nextActions: [...nextActions].sort((a, b) => String(a.next_action_date).localeCompare(String(b.next_action_date))),
  });
}
