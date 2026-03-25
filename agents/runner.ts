import cron from 'node-cron';
import { sql } from '../lib/db';
import { postError } from '../lib/slack';
import { randomUUID } from 'crypto';

import * as csoAgent from './cso-agent';
import * as seProspecting from './se-prospecting-agent';
import * as seOutreach from './se-outreach-agent';
import * as seFollowup from './se-followup-agent';
import * as seBooking from './se-booking-agent';
import * as dkCallprep from './dk-callprep-agent';
import * as dkCalllog from './dk-calllog-agent';
import * as dkFollowup from './dk-followup-agent';
import * as dkNurture from './dk-nurture-agent';
import * as dkPipeline from './dk-pipeline-agent';
import * as dkProspecting from './dk-prospecting-agent';

const AGENTS = {
  'cso': { ...csoAgent, name: 'CSO Agent' },
  'se-prospecting': { ...seProspecting, name: 'SE Prospecting' },
  'se-outreach': { ...seOutreach, name: 'SE Outreach' },
  'se-followup': { ...seFollowup, name: 'SE Follow-up' },
  'se-booking': { ...seBooking, name: 'SE Booking' },
  'dk-callprep': { ...dkCallprep, name: 'DK Call Prep', schedule: dkCallprep.schedule },
  'dk-calllog': { ...dkCalllog, name: 'DK Call Log', schedule: dkCalllog.schedule },
  'dk-followup': { ...dkFollowup, name: 'DK Follow-up', schedule: dkFollowup.schedule },
  'dk-nurture': { ...dkNurture, name: 'DK Nurture', schedule: dkNurture.schedule },
  'dk-pipeline': { ...dkPipeline, name: 'DK Pipeline', schedule: dkPipeline.schedule },
  'dk-prospecting': { ...dkProspecting, name: 'DK Prospecting', schedule: dkProspecting.schedule },
};

export async function runAgent(agentId: string): Promise<{ success: boolean; message: string; duration: number }> {
  const agent = AGENTS[agentId as keyof typeof AGENTS];

  if (!agent) {
    return { success: false, message: `Ukendt agent: ${agentId}`, duration: 0 };
  }

  const startTime = Date.now();
  console.log(`\n[Runner] Starter agent: ${agent.name} (${agentId})`);

  // Set active
  await sql`UPDATE agents SET status = 'active', runs_today = runs_today + 1 WHERE id = ${agentId}`;

  await sql`
    INSERT INTO agent_logs (id, agent_id, action, details, result, created_at)
    VALUES (${randomUUID()}, ${agentId}, 'Agent startet', 'Manuel kørsel initieret', 'info', ${new Date().toISOString()})
  `;

  try {
    const result = await agent.run();
    const duration = Date.now() - startTime;

    await sql`
      UPDATE agents SET
        status = ${result.success ? 'idle' : 'error'},
        last_run = ${new Date().toISOString()},
        last_action = ${result.actions[result.actions.length - 1] || 'Kørsel afsluttet'}
      WHERE id = ${agentId}
    `;

    await sql`
      INSERT INTO agent_logs (id, agent_id, action, details, result, created_at)
      VALUES (${randomUUID()}, ${agentId}, 'Agent afsluttet', ${`Varighed: ${duration}ms. Handlinger: ${result.actions.join(', ')}`}, ${result.success ? 'success' : 'error'}, ${new Date().toISOString()})
    `;

    console.log(`[Runner] ${agent.name} afsluttet på ${duration}ms – ${result.success ? '✅' : '❌'}`);
    return { success: result.success, message: result.actions.join('; '), duration };
  } catch (err) {
    const duration = Date.now() - startTime;
    const error = String(err);

    await sql`UPDATE agents SET status = 'error', last_run = ${new Date().toISOString()} WHERE id = ${agentId}`;

    await postError(agent.name, error);
    console.error(`[Runner] Fejl i ${agent.name}:`, err);

    return { success: false, message: error, duration };
  }
}

function registerCrons() {
  console.log('[Runner] Registrerer cron jobs...');

  for (const [agentId, agent] of Object.entries(AGENTS)) {
    if (!agent.schedule) {
      console.log(`  ⏭ ${agent.name}: ingen cron (manuel trigger)`);
      continue;
    }
    cron.schedule(agent.schedule, async () => {
      console.log(`\n[Cron] Kør ${agent.name} (${agent.schedule})`);
      await runAgent(agentId);
    });
    console.log(`  ✓ ${agent.name}: ${agent.schedule}`);
  }

  console.log('[Runner] Alle cron jobs registreret. Venter på næste kørsel...');
}

export { AGENTS, registerCrons };
