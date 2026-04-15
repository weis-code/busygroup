import { NextRequest, NextResponse } from 'next/server';
import { initSchema, sql } from '@/lib/db';
import { runSwedenOutreach } from '@/lib/agents/sweden-outreach';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/agents/sweden-outreach/daily
 * Silently runs the 3-agent pipeline without SSE streaming.
 * Generates a random batch of 20-50 leads.
 * Designed to be called by a scheduled task / cron.
 * Body: { workspace_id?: string, count?: number, secret?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as {
      workspace_id?: string;
      count?: number;
      secret?: string;
    };

    // Optional shared secret for security
    const expectedSecret = process.env.SCHEDULER_SECRET;
    if (expectedSecret && body.secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await initSchema();

    const workspaceId = body.workspace_id && body.workspace_id !== 'internal'
      ? body.workspace_id
      : null;

    // Random count between 20 and 50 unless explicitly specified
    const count = body.count
      ? Math.max(5, Math.min(50, Number(body.count)))
      : Math.floor(Math.random() * 31) + 20; // 20–50

    const logs: string[] = [];
    const runId = randomUUID();
    const startedAt = new Date().toISOString();

    const { leadIds } = await runSwedenOutreach(
      (event) => { logs.push(`[${event.stage}] ${event.message}`); },
      workspaceId,
      count
    );

    const completedAt = new Date().toISOString();

    // Log the run in agent_logs table
    await sql`
      INSERT INTO agent_logs (id, agent_id, lead_id, action, details, result, created_at)
      VALUES (
        ${runId},
        ${'se-prospecting'},
        ${null},
        ${'daily_run'},
        ${`Generated ${leadIds.length} leads. Log:\n${logs.join('\n')}`},
        ${'success'},
        ${completedAt}
      )
    `.catch(() => {}); // non-critical

    // Update agent last_run and runs_today
    await sql`
      UPDATE agents SET
        status = 'idle',
        last_run = ${completedAt},
        last_action = ${`Generated ${leadIds.length} SE leads`},
        runs_today = runs_today + 1
      WHERE id = 'se-prospecting'
    `.catch(() => {});

    return NextResponse.json({
      success: true,
      leadsGenerated: leadIds.length,
      leadIds,
      startedAt,
      completedAt,
      logs,
    });
  } catch (err) {
    console.error('[daily SE outreach] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
