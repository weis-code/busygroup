/**
 * Sweden Outreach Agent Pipeline
 * Three sequential agents: Prospecting → Research → Email Writer
 *
 * Agent 1 uses Apollo.io API for REAL Swedish companies + verified emails.
 * Agents 2 & 3 use Claude (Anthropic) for research and email writing.
 */

import Anthropic from '@anthropic-ai/sdk';
import { sql } from '@/lib/db';
import { randomUUID } from 'crypto';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ProgressCallback = (event: { stage: string; message: string; lead?: object }) => void;

// ─── Apollo types ─────────────────────────────────────────────────────────────

interface ApolloOrganization {
  name?: string;
  website_url?: string;
  primary_domain?: string;
  estimated_num_employees?: number;
  phone?: string;
  industry?: string;
  city?: string;
  country?: string;
}

interface ApolloPerson {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  email?: string;
  email_status?: string;
  city?: string;
  country?: string;
  phone_numbers?: Array<{ raw_number: string }>;
  organization?: ApolloOrganization;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Guess likely work email patterns from name + domain */
function guessEmail(firstName: string, lastName: string, domain: string): string {
  const f = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const l = lastName.toLowerCase().replace(/[^a-z]/g, '');
  if (!f || !l || !domain) return '';
  // Most common Swedish business email pattern
  return `${f}.${l}@${domain}`;
}

/** Detect vertical from Apollo industry / title */
function detectVertical(industry = '', title = ''): 'klinik' | 'hantverkare' {
  const text = (industry + ' ' + title).toLowerCase();
  if (/dental|tandl|physio|fysio|chiro|kiro|veterinär|vet |klinik|clinic|medical|health|care|läkare|sjukgymnast/.test(text)) return 'klinik';
  return 'hantverkare';
}

// ─── Agent 1: Prospecting via Apollo.io ───────────────────────────────────────

const APOLLO_SEARCH_CONFIGS = [
  {
    // Clinics — dentists, physios, chiros, vets
    vertical: 'klinik' as const,
    person_titles: ['owner', 'clinic owner', 'practice owner', 'CEO', 'managing director', 'verksamhetschef', 'klinikchef', 'ägare'],
    q_keywords: 'tandläkare OR fysioterapi OR kiropraktor OR veterinär OR klinik OR dental clinic OR physiotherapy',
  },
  {
    // Tradesmen — plumbers, electricians, builders, painters
    vertical: 'hantverkare' as const,
    person_titles: ['owner', 'CEO', 'founder', 'ägare', 'VD', 'managing director'],
    q_keywords: 'VVS OR elektriker OR byggföretag OR måleri OR plumbing OR electrical contractor OR construction',
  },
];

export async function runProspecting(
  onProgress: ProgressCallback,
  workspaceId: string | null = null,
  count: number = 10
): Promise<string[]> {
  const apolloKey = process.env.APOLLO_API_KEY;
  if (!apolloKey) throw new Error('APOLLO_API_KEY saknas — tilføj den i Railway environment variables');

  onProgress({ stage: 'prospecting', message: `Søger efter ${count} rigtige svenske virksomheder via Apollo...` });

  const perConfig = Math.ceil(count / APOLLO_SEARCH_CONFIGS.length);
  const allPeople: (ApolloPerson & { _vertical: 'klinik' | 'hantverkare' })[] = [];

  for (const cfg of APOLLO_SEARCH_CONFIGS) {
    onProgress({ stage: 'prospecting', message: `Apollo: søger efter ${cfg.vertical === 'klinik' ? 'klinikker' : 'håndværkere'} i Sverige...` });

    const body = {
      api_key: apolloKey,
      page: 1,
      per_page: perConfig,
      person_locations: ['Sweden'],
      person_titles: cfg.person_titles,
      q_keywords: cfg.q_keywords,
      organization_locations: ['Sweden'],
      organization_num_employees_ranges: ['1,200'],
      contact_email_status: ['verified', 'likely to engage', 'unavailable'],
    };

    const res = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Apollo API fejl (${res.status}): ${err.slice(0, 200)}`);
    }

    const data = await res.json() as { people?: ApolloPerson[]; error?: string };
    if (data.error) throw new Error(`Apollo: ${data.error}`);

    const people = (data.people || []).map(p => ({ ...p, _vertical: cfg.vertical }));
    allPeople.push(...people);
    onProgress({ stage: 'prospecting', message: `Apollo returnerede ${people.length} ${cfg.vertical === 'klinik' ? 'klinik' : 'håndværker'}-kontakter` });
  }

  const now = new Date().toISOString();
  const leadIds: string[] = [];

  for (const person of allPeople) {
    const org = person.organization || {};
    const companyName = org.name || 'Ukendt virksomhed';
    const firstName = person.first_name || '';
    const lastName = person.last_name || '';
    const fullName = person.name || `${firstName} ${lastName}`.trim();
    const title = person.title || '';
    const domain = org.primary_domain || (org.website_url ? org.website_url.replace(/^https?:\/\//, '').split('/')[0] : '');
    const website = org.website_url || (domain ? `https://${domain}` : null);
    const phone = person.phone_numbers?.[0]?.raw_number || org.phone || null;
    const city = person.city || org.city || 'Sverige';
    const empCount = org.estimated_num_employees;
    const companySize = empCount ? `${empCount} employees` : 'Small business';

    // Use Apollo email if available, otherwise guess from name + domain
    const email = (person.email && person.email_status !== 'invalid')
      ? person.email
      : guessEmail(firstName, lastName, domain);

    const vertical = detectVertical(org.industry, title);
    const whyTheyFit = `${vertical === 'klinik' ? 'Clinic' : 'Tradesman'} business in ${city} — likely handling inbound calls manually and could benefit from an AI receptionist to capture every booking.`;

    const id = randomUUID();
    await sql`
      INSERT INTO leads (
        id, company, contact_name, contact_title, email, phone, company_size,
        why_they_fit, priority, status, market, country, vertical,
        decision_maker_name, decision_maker_title, linkedin_url,
        workspace_id, created_at, updated_at
      ) VALUES (
        ${id}, ${companyName}, ${fullName}, ${title},
        ${email || null}, ${phone}, ${companySize},
        ${whyTheyFit}, ${'medium'}, ${'new'}, ${'sweden'}, ${'SE'},
        ${vertical}, ${fullName}, ${title},
        ${website || null}, ${workspaceId}, ${now}, ${now}
      )
    `;
    leadIds.push(id);

    onProgress({
      stage: 'prospecting',
      message: `✓ ${companyName} — ${fullName}${email ? ` (${email})` : ' (email ukendt)'}`,
      lead: { id, company: companyName, city, vertical },
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
