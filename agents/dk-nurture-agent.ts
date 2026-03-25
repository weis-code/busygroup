import Anthropic from '@anthropic-ai/sdk';
import { sql } from '../lib/db';
import { randomUUID } from 'crypto';

export const schedule = '0 7 * * 1-5';

export interface AgentResult {
  success: boolean;
  actions: string[];
  data?: unknown;
  error?: string;
}

const systemPrompt = `Du er nurture-agent for BusyConsultings danske marked.
Du holder varmen på leads der ikke er klar endnu –
dem der sagde 'ring igen om 3 måneder' eller 'ikke lige nu'.

Du laver en nurture-sekvens med op til 5 trin
der blander LinkedIn og email over 60-90 dage.

Hvert trin skal:
- Referere til noget relevant (branchenyt, årstid, konkret problem de har)
- Ikke være sælgende – værdiorienteret
- Føles som om det er skrevet af et menneske

Du returnerer præcis dette JSON:
{
  "sequence": [
    {
      "step": 1,
      "day": 7,
      "channel": "email",
      "subject": "emnelinjen",
      "message": "beskedteksten – max 120 ord",
      "angle": "Kort forklaring: hvorfor denne vinkel"
    },
    {
      "step": 2,
      "day": 21,
      "channel": "linkedin",
      "message": "LinkedIn DM – max 60 ord",
      "angle": "Kort forklaring"
    },
    {
      "step": 3,
      "day": 45,
      "channel": "email",
      "subject": "emnelinjen",
      "message": "beskedteksten",
      "angle": "Kort forklaring"
    },
    {
      "step": 4,
      "day": 60,
      "channel": "email",
      "subject": "emnelinjen",
      "message": "beskedteksten",
      "angle": "Kort forklaring"
    },
    {
      "step": 5,
      "day": 90,
      "channel": "linkedin",
      "message": "Break-up besked – efterlad døren åben",
      "angle": "Kort forklaring"
    }
  ]
}

Regler:
- Trin 1: Altid email – varm opfølgning på opkaldet
- Trin 2+: Skift mellem email og LinkedIn
- Nævr aldrig pris
- Referer til noget specifikt fra opkaldet i trin 1
- Fra trin 2: brug brancherelevante vinkler
- Tone: Professionel, dansk, menneskelig`;

interface NurtureStep {
  step: number;
  day: number;
  channel: string;
  subject?: string;
  message: string;
  angle: string;
}

function buildFallbackSequence(lead: Record<string, unknown>): { sequence: NurtureStep[] } {
  const name = String(lead.contact_name || '').split(' ')[0] || 'dig';
  const company = String(lead.company || '');
  return {
    sequence: [
      {
        step: 1, day: 7, channel: 'email',
        subject: `${name} – én ting vi talte om`,
        message: `Hej ${name},\n\nTak for vores snak. Jeg tænkte på ${company} – mange virksomheder i jeres branche oplever præcis de udfordringer vi diskuterede.\n\nJeg sender denne korte note i tilfælde af, at timingen er bedre nu.\n\nBedste hilsner`,
        angle: 'Direkte reference til opkaldet',
      },
      {
        step: 2, day: 21, channel: 'linkedin',
        message: `Hej ${name}, jeg tænkte på jer. Har situationen ændret sig siden sidst? Vi har hjulpet et par lignende virksomheder de seneste uger. God weekend!`,
        angle: 'Blød check-in',
      },
      {
        step: 3, day: 45, channel: 'email',
        subject: 'Kort opdatering fra BusyConsulting',
        message: `Hej ${name},\n\nJeg ville blot dele at vi for nylig har hjulpet en virksomhed meget lig ${company} med at spare 3+ timer om ugen på telefonhåndtering.\n\nIngen pres – blot tanke at det måske er relevant for jer.\n\nMed venlig hilsen`,
        angle: 'Social proof fra lignende virksomhed',
      },
      {
        step: 4, day: 60, channel: 'email',
        subject: 'Ny funktion der måske interesserer jer',
        message: `Hej ${name},\n\nVi har netop lanceret noget nyt der er relevant for virksomheder som ${company}.\n\nHar I 15 minutter til en hurtig opdatering?\n\nMed venlig hilsen`,
        angle: 'Produkt-nyhed som samtaleåbner',
      },
      {
        step: 5, day: 90, channel: 'linkedin',
        message: `Hej ${name}, dette er min sidste besked for nu. Hvis I aldrig får behov for det vi tilbyder, forstår jeg det fuldt ud. Men hvis situationen ændrer sig, er I altid velkomne til at række ud. Alt det bedste til ${company}!`,
        angle: 'Break-up besked – positiv afsked',
      },
    ],
  };
}

export async function run(): Promise<AgentResult> {
  const actions: string[] = [];
  const now = new Date();

  try {
    // Step 1: Find leads needing a nurture sequence
    const leads = await sql`
      SELECT l.* FROM leads l
      WHERE l.market = 'denmark'
        AND l.status IN ('contacted', 'replied')
        AND l.nurture_active = 0
        AND l.updated_at < NOW() - INTERVAL '3 days'
        AND NOT EXISTS (
          SELECT 1 FROM outreach_sequences os
          WHERE os.lead_id = l.id
            AND os.status NOT IN ('sent', 'replied')
        )
      LIMIT 10
    `;

    actions.push(`Fandt ${leads.length} leads til nurture-sekvens`);
    let nurtured = 0;
    const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

    for (const lead of leads as unknown as Array<Record<string, string>>) {
      try {
        const history = await sql`
          SELECT content FROM notes WHERE lead_id = ${lead.id} ORDER BY created_at DESC LIMIT 3
        `;

        let sequenceData: { sequence: NurtureStep[] } = buildFallbackSequence(lead);

        if (anthropic) {
          const resp = await anthropic.messages.create({
            model: 'claude-opus-4-6',
            max_tokens: 2000,
            system: systemPrompt,
            messages: [{
              role: 'user',
              content: `Lead: ${lead.company}
Kontakt: ${lead.contact_name} (${lead.contact_title})
Status: ${lead.status}
Branche/fit: ${lead.why_they_fit || 'Ikke angivet'}
Størrelse: ${lead.company_size || 'ukendt'}

Seneste noter fra opkald:
${(history as unknown as Array<{ content: string }>).map(n => `- ${n.content}`).join('\n') || 'Ingen noter'}

Generer en 5-trins nurture-sekvens.`,
            }],
          });
          const text = (resp.content[0] as { text: string }).text;
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.sequence?.length > 0) sequenceData = parsed;
          }
        }

        // Save sequence steps
        for (const step of sequenceData.sequence) {
          const followupAt = new Date(now.getTime() + step.day * 24 * 3600000).toISOString();
          const messageText = step.channel === 'email' && step.subject
            ? `EMNE: ${step.subject}\n\n${step.message}`
            : step.message;

          await sql`
            INSERT INTO outreach_sequences (id, lead_id, step, channel, message, status, scheduled_for, created_at)
            VALUES (${randomUUID()}, ${lead.id}, ${step.step}, ${step.channel}, ${messageText}, ${step.step === 1 ? 'draft' : 'scheduled'}, ${followupAt}, ${now.toISOString()})
          `;
        }

        // Update lead
        await sql`UPDATE leads SET nurture_active = 1, followup_draft_ready = 1, updated_at = ${now.toISOString()} WHERE id = ${lead.id}`;

        // Log
        await sql`
          INSERT INTO agent_logs (id, agent_id, lead_id, action, details, result, created_at)
          VALUES (${randomUUID()}, 'dk-nurture', ${lead.id}, 'Nurture-sekvens oprettet', ${`${sequenceData.sequence.length} trin over ${sequenceData.sequence[sequenceData.sequence.length - 1]?.day ?? 90} dage`}, 'success', ${now.toISOString()})
        `;

        nurtured++;
      } catch (e) {
        console.error(`[DK Nurture] Fejl for ${lead.company}:`, e);
      }
    }

    // Step 2: Check scheduled steps due today
    const dueSteps = await sql`
      SELECT os.*, l.company FROM outreach_sequences os
      JOIN leads l ON l.id = os.lead_id
      WHERE l.market = 'denmark'
        AND os.status = 'scheduled'
        AND os.scheduled_for <= NOW()
    `;

    for (const step of dueSteps as unknown as Array<Record<string, string>>) {
      await sql`UPDATE outreach_sequences SET status = 'pending_send' WHERE id = ${step.id}`;
      await sql`UPDATE leads SET followup_draft_ready = 1, updated_at = ${now.toISOString()} WHERE id = ${step.lead_id}`;
    }

    if (dueSteps.length > 0) {
      actions.push(`${dueSteps.length} planlagte trin klar til afsendelse`);
    }

    actions.push(`${nurtured} nurture-sekvenser oprettet`);
    return { success: true, actions, data: { nurtured, dueSteps: dueSteps.length } };
  } catch (err) {
    const error = String(err);
    await sql`
      INSERT INTO agent_logs (id, agent_id, action, details, result, created_at)
      VALUES (${randomUUID()}, 'dk-nurture', 'Fejl under nurture', ${error}, 'error', ${new Date().toISOString()})
    `;
    return { success: false, actions, error };
  }
}
