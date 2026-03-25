import Anthropic from '@anthropic-ai/sdk';
import { sql } from '../lib/db';
import { randomUUID } from 'crypto';

export const schedule = ''; // Triggered via import API

export interface CsvRow {
  company: string;
  contact_name?: string;
  contact_title?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  company_size?: string;
  website?: string;
  industry?: string;
  notes?: string;
}

export interface AgentResult {
  success: boolean;
  actions: string[];
  data?: unknown;
  error?: string;
}

const systemPrompt = `Du er prospecting-agent for BusyConsultings danske salgsteam.
Du analyserer en potentiel kunde og vurderer, om de er et godt match for BusyConsultings produkter.

Produkter vi sælger:
- AI Receptionist: AI der besvarer telefonen automatisk 24/7
- BusyReminder: Automatiske SMS/email-påmindelser til kunder
- Hjemmeside: Professionel hjemmeside til SMB

Gode kunder er typisk: SMV'er (1-50 ansatte), servicefag (håndværkere, klinikker, tandlæger, advokater, ejendomsmæglere, rengøring), virksomheder der mister kunder på ubesvarede opkald.

Du returnerer præcis dette JSON:
{
  "why_they_fit": "2-3 sætninger om hvorfor de er et godt match. Vær specifik om deres branche.",
  "priority": "high | medium | low",
  "priority_reason": "Kort begrundelse for prioritet",
  "company_size_estimate": "Estimeret størrelse hvis ikke angivet, fx '3-8 ansatte'",
  "pain_points": ["smertepunkt 1", "smertepunkt 2"],
  "recommended_products": ["AI Receptionist"],
  "fit_score": 85
}

Prioritetskriterier:
- high: servicefag + lille team + sandsynligt mange opkald = taber klart omsætning
- medium: god match men mindre åbenlyst behov
- low: muligvis relevant men usikkert fit

Fit score: 0-100 baseret på sandsynlighed for køb.`;

export async function researchLead(
  row: CsvRow,
  sessionId: string,
  assignedTo?: string,
): Promise<{ lead_id: string; skipped: boolean; reason?: string }> {
  const now = new Date().toISOString();

  // Skip if company already exists
  const [existing] = await sql`
    SELECT id FROM leads WHERE company = ${row.company} AND market = 'denmark'
  `;

  if (existing) {
    return { lead_id: existing.id as string, skipped: true, reason: 'Eksisterer allerede' };
  }

  const anthropic = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;

  let research = {
    why_they_fit: `${row.company} er et potentielt match for AI Receptionist. Virksomheder i denne branche mister typisk kunder på ubesvarede opkald.`,
    priority: 'medium' as 'high' | 'medium' | 'low',
    priority_reason: 'Ikke nok data til at afgøre prioritet',
    company_size_estimate: row.company_size || '1-10 ansatte',
    pain_points: ['Ubesvarede opkald', 'Manuel administration'],
    recommended_products: ['AI Receptionist'],
    fit_score: 60,
  };

  if (anthropic) {
    try {
      const resp = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 600,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Firma: ${row.company}
${row.contact_name ? `Kontakt: ${row.contact_name}${row.contact_title ? ` (${row.contact_title})` : ''}` : ''}
${row.company_size ? `Størrelse: ${row.company_size}` : ''}
${row.industry ? `Branche: ${row.industry}` : ''}
${row.website ? `Hjemmeside: ${row.website}` : ''}
${row.notes ? `Noter: ${row.notes}` : ''}

Analyser dette lead og vurdér fit med BusyConsultings produkter.`,
        }],
      });
      const text = (resp.content[0] as { text: string }).text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        research = { ...research, ...parsed };
      }
    } catch (e) {
      console.error(`[DK Prospecting] Research fejl for ${row.company}:`, e);
    }
  }

  // Create the lead
  const leadId = randomUUID();
  await sql`
    INSERT INTO leads (
      id, company, contact_name, contact_title, linkedin_url, email, phone,
      company_size, why_they_fit, priority, status, market, assigned_to, created_at, updated_at
    ) VALUES (
      ${leadId}, ${row.company}, ${row.contact_name || ''}, ${row.contact_title || ''}, ${row.linkedin_url || ''}, ${row.email || ''}, ${row.phone || ''},
      ${research.company_size_estimate || row.company_size || ''}, ${research.why_they_fit}, ${research.priority}, 'new', 'denmark', ${assignedTo || null}, ${now}, ${now}
    )
  `;

  // Log the research
  await sql`
    INSERT INTO agent_logs (id, agent_id, lead_id, action, details, result, created_at)
    VALUES (${randomUUID()}, 'dk-prospecting', ${leadId}, 'Lead importeret og researched', ${`Fit score: ${research.fit_score}/100. Anbefalet: ${research.recommended_products?.join(', ')}. ${research.priority_reason}`}, 'success', ${now})
  `;

  return { lead_id: leadId, skipped: false };
}

export async function runSession(
  rows: CsvRow[],
  sessionId: string,
  assignedTo?: string,
): Promise<AgentResult> {
  const actions: string[] = [];
  let created = 0;
  let skipped = 0;

  // Update session to processing
  await sql`UPDATE import_sessions SET status='processing', total_rows=${rows.length} WHERE id=${sessionId}`;

  for (const row of rows) {
    try {
      const result = await researchLead(row, sessionId, assignedTo);
      if (result.skipped) {
        skipped++;
      } else {
        created++;
      }

      // Update progress
      await sql`
        UPDATE import_sessions
        SET processed_rows = processed_rows + 1,
            created_leads = ${created},
            skipped_rows = ${skipped}
        WHERE id = ${sessionId}
      `;

    } catch (e) {
      console.error(`[DK Prospecting] Fejl for ${row.company}:`, e);
      skipped++;
      await sql`UPDATE import_sessions SET processed_rows = processed_rows + 1, skipped_rows = ${skipped} WHERE id = ${sessionId}`;
    }
  }

  const now = new Date().toISOString();
  await sql`
    UPDATE import_sessions
    SET status='completed', completed_at=${now}, created_leads=${created}, skipped_rows=${skipped}
    WHERE id=${sessionId}
  `;

  await sql`
    INSERT INTO agent_logs (id, agent_id, action, details, result, created_at)
    VALUES (${randomUUID()}, 'dk-prospecting', 'CSV import afsluttet', ${`${created} leads oprettet, ${skipped} sprunget over af ${rows.length} rækker`}, 'success', ${now})
  `;

  actions.push(`${created} leads oprettet fra CSV`);
  actions.push(`${skipped} rækker sprunget over (duplikater eller fejl)`);
  return { success: true, actions, data: { created, skipped, total: rows.length } };
}

export async function run(): Promise<AgentResult> {
  return { success: true, actions: ['dk-prospecting startes via CSV import API'], data: null };
}
