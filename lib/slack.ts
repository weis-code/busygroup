import { WebClient } from '@slack/web-api';

const token = process.env.SLACK_BOT_TOKEN;
const client = token ? new WebClient(token) : null;

const CHANNELS = {
  ledelse: 'busygroup-ledelse',
  salg: 'agent-salg-sverige',
  alerts: 'agent-alerts',
};

export async function postMessage(channel: string, text: string): Promise<void> {
  if (!client) {
    console.log(`[Slack MOCK] #${channel}: ${text}`);
    return;
  }
  try {
    await client.chat.postMessage({ channel: `#${channel}`, text });
  } catch (err) {
    console.error('[Slack Error]', err);
  }
}

export async function postWeeklyReport(stats: {
  leadsFound: number;
  outreachSent: number;
  replies: number;
  meetingsBooked: number;
  conversionRate: string;
}): Promise<void> {
  const text = `
*📊 Ugentlig Salgsrapport – BusyConsulting Sverige*

• Leads fundet: *${stats.leadsFound}*
• Outreach sendt: *${stats.outreachSent}*
• Svar modtaget: *${stats.replies}*
• Møder booket: *${stats.meetingsBooked}*
• Conversion rate: *${stats.conversionRate}*

_Rapport genereret automatisk af CSO Agent_
  `.trim();
  await postMessage(CHANNELS.ledelse, text);
}

export async function postLeadsFound(count: number, market: string): Promise<void> {
  const flag = market === 'sweden' ? '🇸🇪' : '🇩🇰';
  await postMessage(CHANNELS.salg, `${flag} Fandt *${count}* nye leads på det ${market === 'sweden' ? 'svenske' : 'danske'} marked.`);
}

export async function postMeetingBooked(lead: { company: string; contact_name: string }, meeting: { scheduled_at: string }): Promise<void> {
  const text = `📅 *Møde booket!*\n• Firma: ${lead.company}\n• Kontakt: ${lead.contact_name}\n• Tidspunkt: ${meeting.scheduled_at}`;
  await postMessage(CHANNELS.salg, text);
  await postMessage(CHANNELS.ledelse, text);
}

export async function postError(agentName: string, error: string): Promise<void> {
  await postMessage(CHANNELS.alerts, `🚨 *Fejl i ${agentName}*\n\`\`\`${error}\`\`\``);
}

export async function postEscalation(message: string): Promise<void> {
  await postMessage(CHANNELS.ledelse, `⚠️ *Eskalering krævet*\n${message}`);
}
