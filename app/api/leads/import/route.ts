export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { randomUUID } from 'crypto';
import type { CsvRow } from '@/agents/dk-prospecting-agent';

// ── Flexible CSV parser ──────────────────────────────────────────────────────
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const cells: string[] = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
        else inQuote = !inQuote;
      } else if ((ch === ',' || ch === ';') && !inQuote) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const headers = parseRow(lines[0]).map(h => h.toLowerCase().trim().replace(/['"]/g, ''));
  return lines.slice(1).map(line => {
    const cells = parseRow(line);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
  }).filter(row => Object.values(row).some(v => v));
}

// ── Column name normaliser ───────────────────────────────────────────────────
const FIELD_ALIASES: Record<string, string[]> = {
  company:       ['firma', 'firmanavn', 'company', 'virksomhed', 'navn', 'name', 'organization', 'organisation', 'company name'],
  contact_name:  ['kontakt', 'kontaktperson', 'contact', 'contact name', 'kontaktnavn', 'full name', 'fulde navn', 'person'],
  contact_title: ['titel', 'stilling', 'title', 'job title', 'jobtitel', 'position', 'role'],
  email:         ['email', 'e-mail', 'mail', 'emailadresse'],
  phone:         ['telefon', 'phone', 'tlf', 'mobil', 'mobile', 'phone number', 'tel'],
  linkedin_url:  ['linkedin', 'linkedin url', 'linkedin profil', 'linkedin_url'],
  company_size:  ['størrelse', 'ansatte', 'medarbejdere', 'employees', 'size', 'company size', 'antal ansatte'],
  website:       ['hjemmeside', 'website', 'url', 'web', 'homepage'],
  industry:      ['branche', 'industry', 'sektor', 'sector', 'kategori', 'category', 'type'],
  notes:         ['noter', 'notes', 'kommentar', 'comment', 'remarks', 'bemærkning'],
};

function mapRow(raw: Record<string, string>): CsvRow | null {
  const mapped: Record<string, string> = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      const val = raw[alias] || raw[alias.replace(/ /g, '_')] || '';
      if (val) { mapped[field] = val; break; }
    }
  }
  if (!mapped.company) return null; // Company name is required
  return mapped as unknown as CsvRow;
}

// ── Route handlers ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const market = (formData.get('market') as string) || 'denmark';

    if (!file) return NextResponse.json({ error: 'Ingen fil uploadet' }, { status: 400 });
    if (!file.name.endsWith('.csv')) return NextResponse.json({ error: 'Kun CSV-filer understøttes' }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Fil er for stor (max 5 MB)' }, { status: 400 });

    const text = await file.text();
    const rawRows = parseCsv(text);

    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'CSV-filen er tom eller har ikke de rette kolonner' }, { status: 400 });
    }

    // Map rows and filter valid ones
    const rows = rawRows.map(mapRow).filter((r): r is CsvRow => r !== null);

    if (rows.length === 0) {
      return NextResponse.json({
        error: 'Ingen gyldige rækker fundet. Sørg for at CSV har en "Firma" eller "Company" kolonne.',
        detected_headers: Object.keys(rawRows[0] ?? {}),
      }, { status: 400 });
    }

    // Create import session
    const sessionId = randomUUID();
    const now = new Date().toISOString();
    const importedBy = req.headers.get('x-user-id') || null;

    await sql`
      INSERT INTO import_sessions (id, filename, market, status, total_rows, processed_rows, skipped_rows, created_leads, created_at)
      VALUES (${sessionId}, ${file.name}, ${market}, 'pending', ${rows.length}, 0, 0, 0, ${now})
    `;

    // Kick off background research (non-blocking)
    import('@/agents/dk-prospecting-agent').then(({ runSession }) => {
      runSession(rows, sessionId, importedBy ?? undefined).catch(async err => {
        console.error('[Import] Fejl under session:', err);
        await sql`UPDATE import_sessions SET status='error', error=${String(err)} WHERE id=${sessionId}`;
      });
    });

    return NextResponse.json({
      session_id: sessionId,
      total_rows: rows.length,
      valid_rows: rows.length,
      filename: file.name,
      preview: rows.slice(0, 3),
      message: `Import startet — ${rows.length} emner researches af AI-agenten`,
    }, { status: 202 });

  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const sessions = await sql`
      SELECT * FROM import_sessions ORDER BY created_at DESC LIMIT 20
    `;
    return NextResponse.json(sessions);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
