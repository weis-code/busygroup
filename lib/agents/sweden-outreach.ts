/**
 * Sweden Outreach Agent Pipeline
 * Three sequential agents: Prospecting → Research → Email Writer
 *
 * Uses claude-sonnet-4-5 via Anthropic SDK.
 * No real external API calls — Claude generates realistic fictional companies.
 */

import Anthropic from '@anthropic-ai/sdk';
import { sql } from '@/lib/db';
import { randomUUID } from 'crypto';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ProgressCallback = (event: { stage: string; message: string; lead?: object }) => void;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProspectedCompany {
  company: string;
  city: string;
  vertical: 'klinik' | 'hantverkare';
  company_size: string;
  website: string;
  phone: string;
  decision_maker_name: string;
  decision_maker_title: string;
  why_they_fit: string;
}

// ─── Agent 1: Prospecting ─────────────────────────────────────────────────────

export async function runProspecting(
  onProgress: ProgressCallback,
  workspaceId: string | null = null,
  count: number = 10
): Promise<string[]> {
  onProgress({ stage: 'prospecting', message: `Finder ${count} svenske virksomheder...` });

  const prompt = `Du er en B2B sales prospecting specialist for AI Receptionist-produktet.

AI Receptionist pitch: "Vi sikrar att ditt företag aldrig missar ett samtal. Vår AI-receptionist svarar samtal, besvarar frågor, bokar möten och kopplar vidare till rätt kollega. 1.000 DKK/månad (ca. 950 SEK)."

Målgrupp: Svenske små-medelstora serviceföretag (5-200 anställda) inom:
- Kliniker (tandläkare, fysioterapeuter, kiropraktorer, veterinärer)
- Hantverkare (VVS, elektriker, byggföretag, målare)

Generera exakt ${count} REALISTISKA svenska företag. Blanda vertikaler. Använd RIKTIGA svenska städer och TROVÄRDIGA namn. Variér städerna — undgå at bruge de samme byer igen og igen.

Svara ENDAST med ett JSON-array, ingen annan text:
[
  {
    "company": "Företagsnamn AB",
    "city": "Stad",
    "vertical": "klinik" ELLER "hantverkare",
    "company_size": "ex. 8 anställda",
    "website": "www.foretagsnamn.se",
    "phone": "+46 XX XXX XX XX",
    "decision_maker_name": "Förnamn Efternamn",
    "decision_maker_title": "Titel",
    "why_they_fit": "1-2 sentences in English about why they are a good fit"
  }
]`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: Math.max(2000, count * 250),
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Prospecting: invalid JSON response');

  const companies: ProspectedCompany[] = JSON.parse(jsonMatch[0]);
  const now = new Date().toISOString();
  const leadIds: string[] = [];

  for (const co of companies) {
    const id = randomUUID();
    await sql`
      INSERT INTO leads (
        id, company, contact_name, contact_title, phone, company_size,
        why_they_fit, priority, status, market, country, vertical,
        decision_maker_name, decision_maker_title, linkedin_url,
        workspace_id, created_at, updated_at
      ) VALUES (
        ${id},
        ${co.company},
        ${co.decision_maker_name},
        ${co.decision_maker_title},
        ${co.phone},
        ${co.company_size},
        ${co.why_they_fit},
        ${'medium'},
        ${'new'},
        ${'sweden'},
        ${'SE'},
        ${co.vertical},
        ${co.decision_maker_name},
        ${co.decision_maker_title},
        ${co.website || null},
        ${workspaceId},
        ${now},
        ${now}
      )
    `;
    leadIds.push(id);

    onProgress({
      stage: 'prospecting',
      message: `Oprettet: ${co.company} (${co.city})`,
      lead: { id, company: co.company, city: co.city, vertical: co.vertical },
    });
  }

  return leadIds;
}

// ─── Agent 2: Research ────────────────────────────────────────────────────────

export async function runResearch(
  leadIds: string[],
  onProgress: ProgressCallback
): Promise<void> {
  onProgress({ stage: 'research', message: 'Researcher virksomheder...' });

  for (const leadId of leadIds) {
    const [lead] = await sql`
      SELECT company, company_size, vertical, why_they_fit, decision_maker_title
      FROM leads WHERE id = ${leadId}
    ` as unknown as Array<{
      company: string;
      company_size: string;
      vertical: string;
      why_they_fit: string;
      decision_maker_title: string;
    }>;

    if (!lead) continue;

    const prompt = `Analyse this Swedish service company and write 3 short research bullet points for a salesperson.

Company: ${lead.company}
Size: ${lead.company_size}
Type: ${lead.vertical === 'klinik' ? 'Clinic (dentist / physio / chiropractor / vet)' : 'Tradesman (plumber / electrician / construction / painter)'}
Background: ${lead.why_they_fit}

Cover:
1. How they likely handle incoming calls today (manual, receptionist, missing calls?)
2. Key pain points for this business type (missed bookings, interrupted treatments, etc.)
3. Concrete value our AI receptionist delivers specifically for them

Return ONLY a raw JSON array — no markdown, no extra text:
["bullet 1", "bullet 2", "bullet 3"]`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      system: 'You are a B2B sales researcher. You ONLY write in English. Never write in Swedish, Danish, or any other language. All output must be English regardless of the language of the input data.',
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = raw.match(/\[[\s\S]*?\]/);
    const bullets: string[] = jsonMatch ? JSON.parse(jsonMatch[0]) : ['Research ej tillgänglig'];
    const researchNotes = bullets.map(b => `• ${b}`).join('\n');

    await sql`
      UPDATE leads SET research_notes = ${researchNotes}, updated_at = ${new Date().toISOString()}
      WHERE id = ${leadId}
    `;

    onProgress({
      stage: 'research',
      message: `Researched: ${lead.company}`,
      lead: { id: leadId, research_notes: researchNotes },
    });
  }
}

// ─── Agent 3: Email Writer ────────────────────────────────────────────────────

export async function runEmailWriter(
  leadIds: string[],
  onProgress: ProgressCallback
): Promise<void> {
  onProgress({ stage: 'email', message: 'Skriver personlige e-mails...' });

  for (const leadId of leadIds) {
    const [lead] = await sql`
      SELECT company, decision_maker_name, vertical, company_size,
             research_notes, why_they_fit
      FROM leads WHERE id = ${leadId}
    ` as unknown as Array<{
      company: string;
      decision_maker_name: string;
      vertical: string;
      company_size: string;
      research_notes: string;
      why_they_fit: string;
    }>;

    if (!lead) continue;

    const firstName = (lead.decision_maker_name || '').split(' ')[0] || 'Hej';

    const prompt = `Write a cold outreach email in English for the following lead.

PRODUCT: AI receptionist — "We make sure your business never misses a call. Our AI receptionist answers calls, takes messages, books appointments, and routes to the right colleague."
PRICE: 1,000 DKK/month (approx. 950 SEK)
BOOKING LINK: [YOUR CALENDLY LINK]

LEAD:
- Name: ${firstName}
- Company: ${lead.company}
- Business type: ${lead.vertical === 'klinik' ? 'Clinic' : 'Tradesman/Craftsman'}
- Size: ${lead.company_size}
- Research notes:
${lead.research_notes || lead.why_they_fit}

RULES — follow these exactly:
- Email MUST be written in English
- Open with "${firstName}," — no "Hi", no "Dear"
- Reference one specific detail from the research notes to show it's personalised
- Clear value proposition in 1 sentence
- State the price: 1,000 DKK/month
- Close with the booking link on its own line
- Body: 100–130 words maximum
- No corporate filler, no "I hope this finds you well", no bullet points in the email itself

Return ONLY raw JSON — no markdown fences, no extra text:
{"subject": "...", "body": "..."}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 800,
      system: 'You are a senior B2B copywriter. You write exclusively in English. Never write in Swedish, Danish, or any other Scandinavian language — even if the company names or input data are in Swedish. All subject lines and email bodies must be in English.',
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);

    let subject = `AI receptionist for ${lead.company}`;
    let body = '';

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        subject = parsed.subject || subject;
        body = parsed.body || '';
      } catch { /* keep defaults */ }
    }

    await sql`
      UPDATE leads
      SET email_subject = ${subject}, email_body = ${body}, updated_at = ${new Date().toISOString()}
      WHERE id = ${leadId}
    `;

    onProgress({
      stage: 'email',
      message: `Mail skrevet: ${lead.company}`,
      lead: { id: leadId, email_subject: subject },
    });
  }
}

// ─── Main entry: run full pipeline ───────────────────────────────────────────

export async function runSwedenOutreach(
  onProgress: ProgressCallback,
  workspaceId: string | null = null,
  count: number = 10
): Promise<{ leadIds: string[] }> {
  const leadIds = await runProspecting(onProgress, workspaceId, count);
  await runResearch(leadIds, onProgress);
  await runEmailWriter(leadIds, onProgress);
  onProgress({ stage: 'done', message: `Færdig! ${leadIds.length} svenske leads klar til outreach.` });
  return { leadIds };
}
