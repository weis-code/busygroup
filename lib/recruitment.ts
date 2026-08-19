export interface StageConfig {
  key: string;
  label: string;
  color: string;
  description: string;
}

export const STAGES: StageConfig[] = [
  { key: 'ansøgt',          label: 'Ansøgt',          color: 'var(--bl)', description: 'Ansøgning modtaget' },
  { key: 'screening',       label: 'Screening',       color: '#06b6d4',   description: 'Indledende screening/vurdering' },
  { key: 'samtale_booket',  label: 'Samtale booket',  color: 'var(--pu)', description: 'Første samtale aftalt' },
  { key: 'samtale_afholdt', label: 'Samtale afholdt', color: '#8b5cf6',   description: 'Samtale gennemført' },
  { key: 'opfølgning',      label: 'Opfølgning',      color: 'var(--ye)', description: 'Afventer svar eller anden samtale' },
  { key: 'tilbud_sendt',    label: 'Tilbud sendt',    color: 'var(--or)', description: 'Jobtilbud sendt til kandidat' },
  { key: 'ansat',           label: 'Ansat ✓',         color: 'var(--gr)', description: 'Tilbud accepteret, opstart aftalt' },
  { key: 'intet_svar',      label: 'Intet svar',      color: 'var(--t3)', description: 'Ingen respons efter kontakt' },
  { key: 'stoppet',         label: 'Stoppet',         color: 'var(--re)', description: 'Afvist eller trukket sig' },
];

export const VALID_STAGES = STAGES.map(s => s.key);

// Ordered pipeline only — excludes the two exit stages (intet_svar/stoppet).
// Used to determine "reached stage X or later" for funnel/conversion calculations.
export const FUNNEL_STAGES = [
  'ansøgt', 'screening', 'samtale_booket', 'samtale_afholdt', 'opfølgning', 'tilbud_sendt', 'ansat',
];

export const COLLAPSED_STAGES_DEFAULT = ['intet_svar', 'stoppet'];

export function stageConfig(key: string): StageConfig | undefined {
  return STAGES.find(s => s.key === key);
}

export interface SourceConfig {
  key: string;
  label: string;
}

export const SOURCES: SourceConfig[] = [
  { key: 'jobopslag',  label: 'Jobopslag' },
  { key: 'netværk',    label: 'Netværk' },
  { key: 'linkedin',   label: 'LinkedIn' },
  { key: 'anbefaling', label: 'Anbefaling' },
  { key: 'andet',      label: 'Andet' },
];

export function sourceLabel(key: string | null): string {
  if (!key) return '—';
  return SOURCES.find(s => s.key === key)?.label ?? key;
}

export const INTERVIEW_FORMATS = [
  { key: 'fysisk', label: 'Fysisk' },
  { key: 'video',  label: 'Video' },
  { key: 'telefon', label: 'Telefon' },
];

export const DEFAULT_CHECKLIST_TEMPLATE_NAME = 'Standard opstart';
export const DEFAULT_CHECKLIST_ITEMS: { title: string; days_before_start: number }[] = [
  { title: 'Kontrakt lavet og underskrevet',    days_before_start: 14 },
  { title: 'Info-mail sendt til kandidat',       days_before_start: 7 },
  { title: 'Adgang til systemer oprettet',       days_before_start: 3 },
  { title: 'Materiale gjort klar',               days_before_start: 2 },
  { title: 'SMS sendt aftenen før opstart',      days_before_start: 1 },
  { title: 'Velkomst på første dag',             days_before_start: 0 },
  { title: 'Introduktionsmøde booket',           days_before_start: 0 },
];

/* ── Formatting helpers (shared client + server) ─────────── */

export function fmtDateShort(d: string | null): string | null {
  if (!d) return null;
  return new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

export function fmtDateLong(d: string | null): string | null {
  if (!d) return null;
  return new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function fmtDatetime(dt: string | null): string | null {
  if (!dt) return null;
  const d = new Date(dt);
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
       + ' kl. ' + d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Lige nu';
  if (m < 60) return `${m} min siden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} t siden`;
  return `${Math.floor(h / 24)} d siden`;
}

// Whole-day difference between today and a date string (positive = future).
export function daysUntil(d: string | null): number | null {
  if (!d) return null;
  const target = new Date(d.slice(0, 10) + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ['#4f8ef7', '#2dd4a0', '#a78bfa', '#f59e0b', '#ff6b35'];
export function avatarColor(name: string): string {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}
