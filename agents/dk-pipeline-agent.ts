import Anthropic from '@anthropic-ai/sdk';
import { sql } from '../lib/db';
import { postWeeklyReport } from '../lib/slack';
import { randomUUID } from 'crypto';

export const schedule = '0 7 * * 1-5'; // Daily weekday digest

export interface AgentResult {
  success: boolean;
  actions: string[];
  data?: unknown;
  error?: string;
}

export async function run(): Promise<AgentResult> {
  const actions: string[] = [];
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  try {
    // Gather pipeline data for DK market
    const statusCounts = await sql`
      SELECT status, COUNT(*) as count FROM leads WHERE market='denmark' GROUP BY status
    `;

    const statusMap = Object.fromEntries((statusCounts as unknown as Array<{ status: string; count: number }>).map(r => [r.status, Number(r.count)]));

    // Leads with high priority or high churn
    const urgent = await sql`
      SELECT id, company, contact_name, status, priority
      FROM leads
      WHERE market = 'denmark'
        AND status NOT IN ('won','lost')
        AND (priority = 'high' OR followup_draft_ready = 1)
      ORDER BY priority DESC
      LIMIT 5
    `;

    // Follow-ups due today (outreach_sequences with pending_send or draft)
    const followUpsDue = await sql`
      SELECT l.id, l.company, l.contact_name, os.channel, os.step, os.scheduled_for as next_followup_at
      FROM outreach_sequences os
      JOIN leads l ON l.id = os.lead_id
      WHERE l.market = 'denmark'
        AND os.status IN ('draft', 'pending_send')
      ORDER BY os.scheduled_for ASC
      LIMIT 10
    `;

    // Meetings today
    const meetingsToday = await sql`
      SELECT m.*, l.company, l.contact_name
      FROM meetings m
      JOIN leads l ON l.id = m.lead_id
      WHERE DATE(m.scheduled_at::timestamp) = ${today}::date
        AND m.status = 'scheduled'
    `;

    // Suggested focus — highest value activity
    const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
    const urgentArr = urgent as unknown as Array<{ company: string; status: string }>;
    let suggestedFocus = `Prioritér opkald til ${urgentArr[0]?.company ?? 'leads med høj prioritet'} i dag`;

    if (anthropic && urgentArr.length > 0) {
      try {
        const resp = await anthropic.messages.create({
          model: 'claude-opus-4-6',
          max_tokens: 200,
          system: 'Du er salgsleder. Skriv ET konkret fokuspunkt på dansk – maks 2 sætninger. Hvad er den vigtigste handling for salgsteamet i dag?',
          messages: [{
            role: 'user',
            content: `Pipeline DK: ${JSON.stringify(statusMap)}
Presserende leads: ${urgentArr.map(l => `${l.company} (${l.status})`).join(', ')}
Opfølgninger klar: ${followUpsDue.length}
Møder i dag: ${meetingsToday.length}`,
          }],
        });
        suggestedFocus = (resp.content[0] as { text: string }).text.trim();
      } catch { /* use default */ }
    }

    // Save daily digest
    const digestId = randomUUID();
    const [existingDigest] = await sql`SELECT id FROM daily_digest WHERE date = ${today}`;

    if (existingDigest) {
      await sql`
        UPDATE daily_digest SET urgent=${JSON.stringify(urgent)}, follow_ups_due=${JSON.stringify(followUpsDue)}, meetings_today=${JSON.stringify(meetingsToday)}, suggested_focus=${suggestedFocus}, created_at=${now.toISOString()} WHERE date=${today}
      `;
    } else {
      await sql`
        INSERT INTO daily_digest (id, date, urgent, follow_ups_due, meetings_today, suggested_focus, created_at)
        VALUES (${digestId}, ${today}, ${JSON.stringify(urgent)}, ${JSON.stringify(followUpsDue)}, ${JSON.stringify(meetingsToday)}, ${suggestedFocus}, ${now.toISOString()})
      `;
    }

    actions.push(`Daglig digest gemt for ${today}`);

    // Weekly Slack report on Mondays
    const dayOfWeek = now.getDay();
    if (dayOfWeek === 1) {
      const total = Object.values(statusMap).reduce((a, b) => a + b, 0);
      const won = statusMap.won || 0;
      const conversion = total > 0 ? Math.round((won / total) * 100) : 0;

      await postWeeklyReport({
        leadsFound: statusMap.new || 0,
        outreachSent: followUpsDue.length,
        replies: statusMap.replied || 0,
        meetingsBooked: statusMap.booked || 0,
        conversionRate: String(conversion) + '%',
      });
      actions.push('Ugentlig Slack-rapport sendt til CSO');
    }

    await sql`
      INSERT INTO agent_logs (id, agent_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'dk-pipeline', 'Daglig digest opdateret', ${`${urgentArr.length} urgent leads, ${followUpsDue.length} opfølgninger klar`}, 'success', ${now.toISOString()})
    `;

    return {
      success: true, actions,
      data: { urgent, followUpsDue, meetingsToday, suggestedFocus, statusMap },
    };
  } catch (err) {
    const error = String(err);
    await sql`
      INSERT INTO agent_logs (id, agent_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'dk-pipeline', 'Fejl i daglig digest', ${error}, 'error', ${new Date().toISOString()})
    `;
    return { success: false, actions, error };
  }
}
