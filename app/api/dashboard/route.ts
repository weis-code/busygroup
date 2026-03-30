import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const role = req.headers.get('x-user-role');
  const userId = req.headers.get('x-user-id');

  try {
    // --- Leads per status ---
    const leadsByStatus = await sql`
      SELECT status, COUNT(*) as count,
        COALESCE(SUM(CAST(pipeline_value AS numeric)), 0) as value
      FROM (
        SELECT l.status,
          COALESCE(SUM(CASE WHEN p.type = 'mrr' THEN p.price * 12 ELSE p.price END), 0) AS pipeline_value
        FROM leads l
        LEFT JOIN lead_products lp ON lp.lead_id = l.id
        LEFT JOIN products p ON p.id = lp.product_id
        WHERE l.status != 'deleted'
        ${role === 'seller' && userId ? sql`AND l.assigned_to = ${userId}` : sql``}
        GROUP BY l.id, l.status
      ) sub
      GROUP BY status
    ` as unknown as Array<{ status: string; count: string; value: string }>;

    // --- Top leads per kanban column (max 4 per col) ---
    const kanbanLeads = await sql`
      SELECT l.id, l.company, l.contact_name, l.status, l.priority, l.market,
        l.assigned_to, u.name as assigned_name,
        COALESCE(SUM(CASE WHEN p.type = 'mrr' THEN p.price * 12 ELSE p.price END), 0) AS pipeline_value
      FROM leads l
      LEFT JOIN lead_products lp ON lp.lead_id = l.id
      LEFT JOIN products p ON p.id = lp.product_id
      LEFT JOIN users u ON u.id = l.assigned_to
      WHERE l.status IN ('new','contacted','replied','interested','booked','won')
        AND l.status != 'deleted'
        ${role === 'seller' && userId ? sql`AND l.assigned_to = ${userId}` : sql``}
      GROUP BY l.id, u.name
      ORDER BY l.updated_at DESC
    ` as unknown as Array<{
      id: string; company: string; contact_name: string | null;
      status: string; priority: string; market: string;
      assigned_name: string | null; pipeline_value: number;
    }>;

    // --- Recent agent activity (last 12) ---
    const activity = await sql`
      SELECT al.id, al.action, al.details, al.result, al.created_at,
        a.name as agent_name, l.company as lead_company
      FROM agent_logs al
      LEFT JOIN agents a ON a.id = al.agent_id
      LEFT JOIN leads l ON l.id = al.lead_id
      ORDER BY al.created_at DESC
      LIMIT 12
    ` as unknown as Array<{
      id: string; action: string; details: string | null; result: string;
      created_at: string; agent_name: string; lead_company: string | null;
    }>;

    // --- Outreach this month ---
    const [outreachRow] = await sql`
      SELECT COUNT(*) as count FROM outreach_sequences
      WHERE status = 'sent'
        AND sent_at >= date_trunc('month', now())::text
    ` as unknown as Array<{ count: string }>;

    // --- Meetings this week ---
    const [meetingsRow] = await sql`
      SELECT COUNT(*) as count FROM meetings
      WHERE scheduled_at >= date_trunc('week', now())::text
    ` as unknown as Array<{ count: string }>;

    // --- Users (team) ---
    const users = await sql`
      SELECT id, name, email, role FROM users ORDER BY name
    ` as unknown as Array<{ id: string; name: string; email: string; role: string }>;

    // --- Agents ---
    const agents = await sql`
      SELECT id, name, market, status, last_action, last_run FROM agents ORDER BY market, name
    ` as unknown as Array<{
      id: string; name: string; market: string; status: string;
      last_action: string | null; last_run: string | null;
    }>;

    // --- Build summary ---
    const statusMap: Record<string, number> = {};
    const valueMap: Record<string, number> = {};
    for (const row of leadsByStatus) {
      statusMap[row.status] = Number(row.count);
      valueMap[row.status] = Number(row.value);
    }

    const activeDeals = (statusMap.contacted || 0) + (statusMap.replied || 0)
      + (statusMap.interested || 0) + (statusMap.booked || 0);

    const pipelineTotal = Object.entries(valueMap)
      .filter(([s]) => ['interested', 'booked', 'won'].includes(s))
      .reduce((sum, [, v]) => sum + v, 0);

    const wonThisMonth = valueMap.won || 0;

    return NextResponse.json({
      kpi: {
        pipeline_total: pipelineTotal,
        active_deals: activeDeals,
        outreach_this_month: Number(outreachRow?.count || 0),
        meetings_this_week: Number(meetingsRow?.count || 0),
        won_this_month: wonThisMonth,
        total_leads: Object.values(statusMap).reduce((a, b) => a + b, 0),
      },
      status_counts: statusMap,
      kanban: kanbanLeads,
      activity,
      users,
      agents,
    });
  } catch (err) {
    console.error('[dashboard]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
