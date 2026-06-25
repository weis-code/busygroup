'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ── Types ─────────────────────────────────────────── */
interface Task { id: number; name: string; client: string | null }
interface NextActionEntry { id: number; type: string; next_action: string; next_action_date: string }
interface Deal {
  id: number; title: string; value: number | null; stage: string; status: string;
  product: string | null;
  prospect_name: string | null; prospect_company: string | null;
  prospect_phone: string | null; prospect_email: string | null;
  owner_name: string; touchpoint_count: number;
  next_action_entry: NextActionEntry | null;
}
interface Touchpoint {
  id: number; type: string; direction: string | null; title: string; body: string | null;
  outcome: string | null; duration_minutes: number | null;
  next_action: string | null; next_action_date: string | null; next_action_done: boolean;
  extra: Record<string, unknown>; owner_name: string; created_at: string;
}
interface UpcomingItem {
  id: number; type: string; next_action: string; next_action_date: string;
  deal_id: number; deal_title: string; contact_name: string | null;
}
interface Upcoming { overdue: UpcomingItem[]; today: UpcomingItem[]; thisWeek: UpcomingItem[]; later: UpcomingItem[] }

/* ── Constants ─────────────────────────────────────── */
const STAGES: { key: string; label: string; color: string }[] = [
  { key: 'lead',        label: 'Lead',        color: 'var(--t3)' },
  { key: 'kontaktet',   label: 'Kontaktet',   color: 'var(--bl)' },
  { key: 'demo',        label: 'Demo',        color: 'var(--pu)' },
  { key: 'tilbud',      label: 'Tilbud',      color: 'var(--ye)' },
  { key: 'forhandling', label: 'Forhandling', color: 'var(--or)' },
  { key: 'vundet',      label: 'Vundet',      color: 'var(--gr)' },
  { key: 'tabt',        label: 'Tabt',        color: 'var(--re)' },
];

const TYPE_META: Record<string, { icon: string; label: string }> = {
  call:      { icon: '📞', label: 'Opkald' },
  email:     { icon: '📧', label: 'Email' },
  meeting:   { icon: '🤝', label: 'Møde' },
  demo:      { icon: '💻', label: 'Demo' },
  proposal:  { icon: '📄', label: 'Tilbud' },
  follow_up: { icon: '🔔', label: 'Opfølgning' },
  linkedin:  { icon: '🔗', label: 'LinkedIn' },
  note:      { icon: '📝', label: 'Note' },
};

const CALL_OUTCOMES     = ['Svarede', 'Svarede ikke', 'Voicemail', 'Forkert nummer', 'Ringet tilbage'];
const EMAIL_OUTCOMES    = ['Sendt', 'Åbnet', 'Svar modtaget', 'Intet svar'];
const MEETING_OUTCOMES  = ['Positivt', 'Neutralt', 'Negativt'];
const DEMO_OUTCOMES     = ['Meget interesseret', 'Interesseret', 'Neutral', 'Ikke interesseret'];
const FOLLOWUP_OUTCOMES = ['Svar modtaget', 'Intet svar', 'Positiv', 'Negativ'];
const LINKEDIN_OUTCOMES = ['Accepteret', 'Intet svar', 'Svar modtaget'];

/* ── Helpers ───────────────────────────────────────── */
const fmt = (n: number) => Number(n).toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' kr';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Lige nu';
  if (m < 60) return `${m} min siden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} t siden`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d siden`;
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

function fmtDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return dateStr < new Date().toISOString().slice(0, 10);
}

function groupByDate(touchpoints: Touchpoint[]): { label: string; items: Touchpoint[] }[] {
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const weekAgo   = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const groups    = new Map<string, Touchpoint[]>();
  for (const t of touchpoints) {
    const d = t.created_at.slice(0, 10);
    let key: string;
    if (d === today)     key = 'I dag';
    else if (d === yesterday) key = 'I går';
    else if (d >= weekAgo)    key = 'Denne uge';
    else key = new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

/* ── Toast ─────────────────────────────────────────── */
function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, [onDone]);
  return <div className="toast-container"><div className="toast">{msg}</div></div>;
}

/* ── Log Activity Form ─────────────────────────────── */
function LogActivityForm({ dealId, onSaved }: { dealId: number; onSaved: () => void }) {
  const [open, setOpen]   = useState(false);
  const [type, setType]   = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm]   = useState({
    direction: '', outcome: '', body: '', duration_minutes: '',
    next_action: '', next_action_date: '',
    extra_meeting_format: '', extra_participants: '',
    extra_demo_platform: '', extra_proposal_amount: '', extra_proposal_via: '',
    extra_followup_channel: '', extra_linkedin_action: '',
  });

  function set(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function submit() {
    if (!type) return;
    setSaving(true);
    const extra: Record<string, string> = {};
    if (form.extra_meeting_format)   extra.meeting_format   = form.extra_meeting_format;
    if (form.extra_participants)     extra.participants     = form.extra_participants;
    if (form.extra_demo_platform)    extra.demo_platform    = form.extra_demo_platform;
    if (form.extra_proposal_amount)  extra.proposal_amount  = form.extra_proposal_amount;
    if (form.extra_proposal_via)     extra.proposal_via     = form.extra_proposal_via;
    if (form.extra_followup_channel) extra.followup_channel = form.extra_followup_channel;
    if (form.extra_linkedin_action)  extra.linkedin_action  = form.extra_linkedin_action;

    await fetch('/api/crm/touchpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deal_id: dealId, type,
        direction: form.direction || null,
        body: form.body || null,
        outcome: form.outcome || null,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
        next_action: form.next_action || null,
        next_action_date: form.next_action_date || null,
        extra,
      }),
    });

    setSaving(false);
    setOpen(false);
    setType('');
    setForm({ direction: '', outcome: '', body: '', duration_minutes: '', next_action: '', next_action_date: '', extra_meeting_format: '', extra_participants: '', extra_demo_platform: '', extra_proposal_amount: '', extra_proposal_via: '', extra_followup_channel: '', extra_linkedin_action: '' });
    onSaved();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ width: '100%', padding: '10px 0', borderRadius: 8, background: 'var(--bl2)', border: '1px dashed rgba(79,142,247,0.4)', color: 'var(--bl)', fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
        + Log aktivitet
      </button>
    );
  }

  return (
    <div style={{ background: 'var(--s2)', border: '1px solid var(--bd2)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
      {/* Type picker */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {Object.entries(TYPE_META).map(([k, v]) => (
          <button key={k} onClick={() => setType(k)} title={v.label} style={{ fontSize: 18, padding: '6px 10px', borderRadius: 7, background: type === k ? 'var(--bl2)' : 'var(--s3)', border: type === k ? '1px solid var(--bl)' : '1px solid var(--bd)', cursor: 'pointer' }}>
            {v.icon}
          </button>
        ))}
      </div>

      {type && (
        <>
          {type === 'email' && (
            <div style={{ marginBottom: 10 }}>
              <label>Retning</label>
              <select value={form.direction} onChange={e => set('direction', e.target.value)}>
                <option value="">Vælg…</option>
                <option value="outbound">Udgående</option>
                <option value="inbound">Indgående</option>
              </select>
            </div>
          )}

          {type === 'call' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div><label>Varighed (min)</label><input type="number" placeholder="4" value={form.duration_minutes} onChange={e => set('duration_minutes', e.target.value)} /></div>
              <div>
                <label>Udfald</label>
                <select value={form.outcome} onChange={e => set('outcome', e.target.value)}>
                  <option value="">Vælg…</option>
                  {CALL_OUTCOMES.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          )}

          {type === 'email' && (
            <div style={{ marginBottom: 10 }}>
              <label>Udfald</label>
              <select value={form.outcome} onChange={e => set('outcome', e.target.value)}>
                <option value="">Vælg…</option>
                {EMAIL_OUTCOMES.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          )}

          {type === 'meeting' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <label>Mødeform</label>
                <select value={form.extra_meeting_format} onChange={e => set('extra_meeting_format', e.target.value)}>
                  <option value="">Vælg…</option>
                  <option>Fysisk</option><option>Video</option><option>Telefon</option>
                </select>
              </div>
              <div>
                <label>Udfald</label>
                <select value={form.outcome} onChange={e => set('outcome', e.target.value)}>
                  <option value="">Vælg…</option>
                  {MEETING_OUTCOMES.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label>Deltagere</label>
                <input placeholder="Hvem var med?" value={form.extra_participants} onChange={e => set('extra_participants', e.target.value)} />
              </div>
            </div>
          )}

          {type === 'demo' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <label>Platform</label>
                <select value={form.extra_demo_platform} onChange={e => set('extra_demo_platform', e.target.value)}>
                  <option value="">Vælg…</option>
                  <option>Teams</option><option>Zoom</option><option>Fysisk</option><option>Andet</option>
                </select>
              </div>
              <div>
                <label>Udfald</label>
                <select value={form.outcome} onChange={e => set('outcome', e.target.value)}>
                  <option value="">Vælg…</option>
                  {DEMO_OUTCOMES.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          )}

          {type === 'proposal' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div><label>Tilbudsbeløb (DKK)</label><input type="number" placeholder="50000" value={form.extra_proposal_amount} onChange={e => set('extra_proposal_amount', e.target.value)} /></div>
              <div>
                <label>Sendt via</label>
                <select value={form.extra_proposal_via} onChange={e => set('extra_proposal_via', e.target.value)}>
                  <option value="">Vælg…</option>
                  <option>Email</option><option>Fysisk</option><option>Andet</option>
                </select>
              </div>
            </div>
          )}

          {type === 'follow_up' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <label>Kanal</label>
                <select value={form.extra_followup_channel} onChange={e => set('extra_followup_channel', e.target.value)}>
                  <option value="">Vælg…</option>
                  <option>Email</option><option>Opkald</option><option>LinkedIn</option><option>SMS</option>
                </select>
              </div>
              <div>
                <label>Udfald</label>
                <select value={form.outcome} onChange={e => set('outcome', e.target.value)}>
                  <option value="">Vælg…</option>
                  {FOLLOWUP_OUTCOMES.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          )}

          {type === 'linkedin' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <label>Handling</label>
                <select value={form.extra_linkedin_action} onChange={e => set('extra_linkedin_action', e.target.value)}>
                  <option value="">Vælg…</option>
                  <option>Forbindelsesanmodning</option><option>Besked sendt</option><option>Kommentar</option><option>Inmail</option>
                </select>
              </div>
              <div>
                <label>Udfald</label>
                <select value={form.outcome} onChange={e => set('outcome', e.target.value)}>
                  <option value="">Vælg…</option>
                  {LINKEDIN_OUTCOMES.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <label>{type === 'note' ? 'Note' : 'Resume / noter'}</label>
            <textarea rows={3} placeholder={type === 'note' ? 'Skriv hvad du vil huske…' : 'Hvad skete der?'} value={form.body} onChange={e => set('body', e.target.value)} />
          </div>

          {type !== 'note' && (
            <div style={{ background: 'var(--s3)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 8 }}>Næste handling</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input placeholder="Ring igen, send tilbud…" value={form.next_action} onChange={e => set('next_action', e.target.value)} />
                <input type="date" value={form.next_action_date} onChange={e => set('next_action_date', e.target.value)} style={{ width: 140 }} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setOpen(false); setType(''); }} style={{ flex: 1, padding: '8px 0', borderRadius: 7, background: 'var(--s3)', color: 'var(--t3)', border: '1px solid var(--bd)', fontSize: 12 }}>Annuller</button>
            <button onClick={submit} disabled={!type || saving} style={{ flex: 2, padding: '8px 0', borderRadius: 7, background: 'var(--bl)', color: '#fff', fontSize: 12, fontWeight: 700 }}>
              {saving ? 'Gemmer…' : 'Log aktivitet'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Touchpoint Entry ───────────────────────────────── */
function TouchpointEntry({ t, onRefresh }: { t: Touchpoint; onRefresh: () => void }) {
  const meta    = TYPE_META[t.type] ?? { icon: '•', label: t.type };
  const overdue = t.next_action && !t.next_action_done && isOverdue(t.next_action_date);
  const [hovered, setHovered] = useState(false);

  async function markDone() {
    await fetch(`/api/crm/touchpoints/${t.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ next_action_done: true }) });
    onRefresh();
  }
  async function del() {
    if (!confirm('Slet denne aktivitet?')) return;
    await fetch(`/api/crm/touchpoints/${t.id}`, { method: 'DELETE' });
    onRefresh();
  }

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ display: 'flex', gap: 10, padding: '12px 0', borderBottom: '1px solid var(--bd)' }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--s3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, marginTop: 2 }}>
        {meta.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{t.title}</div>
          <div style={{ fontSize: 10, color: 'var(--t3)', flexShrink: 0 }}>{timeAgo(t.created_at)}</div>
        </div>
        {t.body && <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 3, lineHeight: 1.5 }}>{t.body}</div>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
          {t.outcome && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 100, background: 'var(--s3)', color: 'var(--t2)', fontWeight: 600 }}>{t.outcome}</span>}
          {t.duration_minutes && <span style={{ fontSize: 10, color: 'var(--t3)', padding: '2px 7px', borderRadius: 100, background: 'var(--s3)' }}>{t.duration_minutes} min</span>}
        </div>
        {t.next_action && !t.next_action_done && (
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: overdue ? 'var(--re)' : 'var(--or)', background: overdue ? 'var(--re2)' : 'var(--or2)', padding: '2px 8px', borderRadius: 100, fontWeight: 600 }}>
              {overdue ? '⚠ ' : ''}Næste: {t.next_action}{t.next_action_date ? ` · ${fmtDate(t.next_action_date)}` : ''}
            </span>
            <button onClick={markDone} style={{ fontSize: 10, color: 'var(--gr)', background: 'var(--gr2)', border: 'none', borderRadius: 100, padding: '2px 8px', fontWeight: 600, cursor: 'pointer' }}>✓ Udført</button>
          </div>
        )}
        {t.next_action && t.next_action_done && (
          <div style={{ marginTop: 5, fontSize: 10, color: 'var(--t3)', textDecoration: 'line-through' }}>{t.next_action}</div>
        )}
        {hovered && (
          <button onClick={del} style={{ fontSize: 10, color: 'var(--re)', background: 'none', border: 'none', padding: '4px 0 0', cursor: 'pointer', opacity: 0.7 }}>Slet</button>
        )}
      </div>
    </div>
  );
}

/* ── Deal Panel ─────────────────────────────────────── */
function DealPanel({ deal, tasks, onClose, onStageChange, onUpdated }: {
  deal: Deal; tasks: Task[]; onClose: () => void;
  onStageChange: (stage: string) => void; onUpdated: () => void;
}) {
  const [touchpoints, setTouchpoints] = useState<Touchpoint[]>([]);
  const [loading, setLoading]         = useState(true);
  const [editingProduct, setEditingProduct] = useState(false);
  const [product, setProduct]         = useState(deal.product ?? '');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetch(`/api/crm/deals/${deal.id}`).then(r => r.json()) as { deal: Deal; touchpoints: Touchpoint[] };
    if (Array.isArray(data.touchpoints)) setTouchpoints(data.touchpoints);
    setLoading(false);
  }, [deal.id]);

  useEffect(() => { load(); }, [load]);

  async function changeStage(stage: string) {
    await fetch(`/api/crm/deals/${deal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage }) });
    onStageChange(stage);
  }

  async function saveProduct() {
    await fetch(`/api/crm/deals/${deal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product: product || null }) });
    setEditingProduct(false);
    onUpdated();
  }

  const groups = groupByDate(touchpoints);
  const stageInfo = STAGES.find(s => s.key === deal.stage);

  return (
    <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 480, background: 'var(--s1)', borderLeft: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', zIndex: 300, boxShadow: '-20px 0 60px rgba(0,0,0,0.4)' }}>
      {/* Header */}
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>{deal.title}</div>
            {(deal.prospect_name || deal.prospect_company) && (
              <div style={{ fontSize: 12, color: 'var(--t2)' }}>
                {deal.prospect_name}{deal.prospect_company ? ` · ${deal.prospect_company}` : ''}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--s2)', color: 'var(--t3)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--bd)', flexShrink: 0 }}>×</button>
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Stage */}
          <select value={deal.stage} onChange={e => changeStage(e.target.value)} style={{ fontSize: 11, padding: '4px 8px', background: stageInfo ? `${stageInfo.color}22` : 'var(--s2)', border: `1px solid ${stageInfo?.color ?? 'var(--bd2)'}44`, borderRadius: 6, color: stageInfo?.color ?? 'var(--t2)', fontWeight: 700, width: 'auto' }}>
            {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>

          {/* Value */}
          {deal.value && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gr)' }}>{fmt(Number(deal.value))}</span>}

          {/* Phone */}
          {deal.prospect_phone && (
            <a href={`tel:${deal.prospect_phone}`} style={{ fontSize: 11, color: 'var(--bl)', textDecoration: 'none', padding: '4px 8px', background: 'var(--bl2)', borderRadius: 6 }}>📞 {deal.prospect_phone}</a>
          )}
        </div>

        {/* Product */}
        <div style={{ marginTop: 10 }}>
          {editingProduct ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={product} onChange={e => setProduct(e.target.value)} style={{ flex: 1, fontSize: 12 }}>
                <option value="">Intet produkt valgt</option>
                {tasks.map(t => <option key={t.id} value={t.name}>{t.name}{t.client ? ` (${t.client})` : ''}</option>)}
              </select>
              <button onClick={saveProduct} style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--bl)', color: '#fff', fontSize: 11, fontWeight: 600, border: 'none' }}>Gem</button>
              <button onClick={() => { setEditingProduct(false); setProduct(deal.product ?? ''); }} style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--s3)', color: 'var(--t3)', fontSize: 11, border: '1px solid var(--bd)' }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setEditingProduct(true)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              {deal.product
                ? <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 100, background: 'var(--pu2)', color: 'var(--pu)', fontWeight: 600 }}>🏷 {deal.product}</span>
                : <span style={{ fontSize: 11, color: 'var(--t3)', borderBottom: '1px dashed var(--t3)' }}>+ Vælg produkt</span>
              }
            </button>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
        <LogActivityForm dealId={deal.id} onSaved={load} />

        {loading && <div style={{ color: 'var(--t3)', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>Indlæser…</div>}

        {!loading && touchpoints.length === 0 && (
          <div style={{ color: 'var(--t3)', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>
            Ingen aktiviteter endnu.<br />Log den første handling ovenfor.
          </div>
        )}

        {!loading && groups.map(g => (
          <div key={g.label}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', padding: '12px 0 4px' }}>{g.label}</div>
            {g.items.map(t => <TouchpointEntry key={t.id} t={t} onRefresh={load} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Deal Card ─────────────────────────────────────── */
function DealCard({ deal, selected, onClick }: { deal: Deal; selected: boolean; onClick: () => void }) {
  const stageInfo = STAGES.find(s => s.key === deal.stage);
  const na        = deal.next_action_entry;
  const naOverdue = na && isOverdue(na.next_action_date);

  return (
    <div onClick={onClick} style={{ background: 'var(--s2)', border: `1px solid ${selected ? 'var(--bl)' : 'var(--bd)'}`, borderRadius: 9, padding: '11px 13px', marginBottom: 8, cursor: 'pointer', borderLeft: `3px solid ${stageInfo?.color ?? 'var(--t3)'}`, transition: 'border-color 0.15s' }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = 'var(--bd2)'; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = 'var(--bd)'; }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>{deal.title}</div>
      {(deal.prospect_name || deal.prospect_company) && (
        <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>{deal.prospect_name || deal.prospect_company}</div>
      )}
      {deal.product && (
        <div style={{ fontSize: 10, padding: '2px 7px', borderRadius: 100, background: 'var(--pu2)', color: 'var(--pu)', fontWeight: 600, display: 'inline-block', marginBottom: 4 }}>{deal.product}</div>
      )}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {deal.value && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gr)' }}>{fmt(Number(deal.value))}</span>}
        <span style={{ fontSize: 10, color: 'var(--t3)', background: 'var(--s3)', padding: '1px 6px', borderRadius: 4 }}>{deal.touchpoint_count} akt.</span>
      </div>
      {na && (
        <div style={{ marginTop: 6, fontSize: 10, color: naOverdue ? 'var(--re)' : 'var(--or)', background: naOverdue ? 'var(--re2)' : 'var(--or2)', padding: '3px 8px', borderRadius: 100, display: 'inline-block' }}>
          {naOverdue ? '⚠ ' : ''}{TYPE_META[na.type]?.icon} {na.next_action}{na.next_action_date ? ` · ${fmtDate(na.next_action_date)}` : ''}
        </div>
      )}
    </div>
  );
}

/* ── New Deal Modal ─────────────────────────────────── */
function NewDealModal({ tasks, onClose, onCreated }: { tasks: Task[]; onClose: () => void; onCreated: (d: Deal) => void }) {
  const [form, setForm] = useState({ title: '', prospect_name: '', prospect_company: '', prospect_phone: '', prospect_email: '', product: '', value: '', stage: 'lead', expected_close: '', notes: '' });
  const [saving, setSaving] = useState(false);
  function set(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const deal = await fetch('/api/crm/deals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, value: form.value ? Number(form.value) : null }),
    }).then(r => r.json()) as Deal;
    setSaving(false);
    onCreated(deal);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--s1)', borderRadius: 13, padding: 24, width: 460, maxWidth: '94vw', boxShadow: '0 40px 80px rgba(0,0,0,0.7)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 20 }}>Nyt lead</div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label>Titel *</label><input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Tandlæge Svendsen — booking" required /></div>

          <div>
            <label>Produkt / opgave</label>
            <select value={form.product} onChange={e => set('product', e.target.value)}>
              <option value="">Vælg produkt…</option>
              {tasks.map(t => <option key={t.id} value={t.name}>{t.name}{t.client ? ` (${t.client})` : ''}</option>)}
            </select>
          </div>

          <div style={{ background: 'var(--s2)', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 10 }}>Prospect</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><label>Navn</label><input value={form.prospect_name} onChange={e => set('prospect_name', e.target.value)} placeholder="Jens Jensen" /></div>
                <div><label>Firma</label><input value={form.prospect_company} onChange={e => set('prospect_company', e.target.value)} placeholder="Jensen A/S" /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><label>Telefon</label><input value={form.prospect_phone} onChange={e => set('prospect_phone', e.target.value)} placeholder="+45 12 34 56 78" /></div>
                <div><label>Email</label><input type="email" value={form.prospect_email} onChange={e => set('prospect_email', e.target.value)} placeholder="jens@firma.dk" /></div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label>Dealværdi (DKK)</label><input type="number" value={form.value} onChange={e => set('value', e.target.value)} placeholder="50000" /></div>
            <div>
              <label>Stage</label>
              <select value={form.stage} onChange={e => set('stage', e.target.value)}>
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div><label>Forventet lukning</label><input type="date" value={form.expected_close} onChange={e => set('expected_close', e.target.value)} /></div>
          <div><label>Noter</label><textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>

          <div style={{ display: 'flex', gap: 8, marginTop: 4, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12 }}>Annuller</button>
            <button type="submit" disabled={saving} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600 }}>{saving ? 'Opretter…' : 'Opret lead'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Næste Handlinger ───────────────────────────────── */
function NaesteHandlingerPanel({ upcoming, onSelectDeal }: { upcoming: Upcoming; onSelectDeal: (id: number) => void }) {
  const [open, setOpen] = useState(true);
  const total = upcoming.overdue.length + upcoming.today.length + upcoming.thisWeek.length;

  function renderItem(item: UpcomingItem, urgent = false) {
    const meta = TYPE_META[item.type] ?? { icon: '•' };
    return (
      <button key={item.id} onClick={() => onSelectDeal(item.deal_id)} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', width: '100%', padding: '7px 8px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--s2)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
        <span style={{ fontSize: 14 }}>{meta.icon}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: urgent ? 'var(--re)' : 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.next_action}</div>
          <div style={{ fontSize: 10, color: 'var(--t3)' }}>{item.deal_title}{item.next_action_date ? ` · ${fmtDate(item.next_action_date)}` : ''}</div>
        </div>
      </button>
    );
  }

  return (
    <div style={{ width: 240, flexShrink: 0, background: 'var(--s1)', borderRight: '1px solid var(--bd)', display: 'flex', flexDirection: 'column' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 0, background: 'none', border: 'none', borderBottom: '1px solid var(--bd)', color: 'var(--t2)', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
        <span>Næste handlinger</span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {total > 0 && <span style={{ background: upcoming.overdue.length > 0 ? 'var(--re)' : 'var(--or)', color: '#fff', borderRadius: 100, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>{total}</span>}
          <span style={{ opacity: 0.5, fontSize: 10 }}>{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
          {upcoming.overdue.length > 0 && <>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--re)', letterSpacing: '0.09em', textTransform: 'uppercase', padding: '6px 8px 2px' }}>Overskredet</div>
            {upcoming.overdue.map(i => renderItem(i, true))}
          </>}
          {upcoming.today.length > 0 && <>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ye)', letterSpacing: '0.09em', textTransform: 'uppercase', padding: '6px 8px 2px' }}>I dag</div>
            {upcoming.today.map(i => renderItem(i))}
          </>}
          {upcoming.thisWeek.length > 0 && <>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', padding: '6px 8px 2px' }}>Denne uge</div>
            {upcoming.thisWeek.map(i => renderItem(i))}
          </>}
          {upcoming.later.length > 0 && <>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', padding: '6px 8px 2px' }}>Senere</div>
            {upcoming.later.map(i => renderItem(i))}
          </>}
          {total === 0 && upcoming.later.length === 0 && (
            <div style={{ color: 'var(--t4)', fontSize: 11, padding: '16px 8px', textAlign: 'center' }}>Ingen planlagte handlinger</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────── */
export default function CrmPipelinePage() {
  const [deals, setDeals]         = useState<Deal[]>([]);
  const [tasks, setTasks]         = useState<Task[]>([]);
  const [upcoming, setUpcoming]   = useState<Upcoming>({ overdue: [], today: [], thisWeek: [], later: [] });
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showNewDeal, setShowNewDeal]   = useState(false);
  const [toast, setToast]         = useState('');
  const [loading, setLoading]     = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  async function loadDeals() {
    const rows = await fetch('/api/crm/deals?status=open').then(r => r.json()) as Deal[];
    if (Array.isArray(rows)) setDeals(rows);
  }
  async function loadUpcoming() {
    const u = await fetch('/api/crm/touchpoints/upcoming').then(r => r.json()) as Upcoming;
    if (u?.overdue) setUpcoming(u);
  }
  async function loadTasks() {
    const data = await fetch('/api/admin/tasks').then(r => r.json()) as { tasks?: Task[] } | Task[];
    const list = Array.isArray(data) ? data : (data as { tasks?: Task[] }).tasks ?? [];
    setTasks(list);
  }

  async function loadAll() {
    setLoading(true);
    try {
      await fetch('/api/crm/migrate', { method: 'POST' });
      await Promise.all([loadDeals(), loadUpcoming(), loadTasks()]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleStageChange(stage: string) {
    if (!selectedDeal) return;
    setSelectedDeal(d => d ? { ...d, stage } : null);
    setDeals(ds => ds.map(d => d.id === selectedDeal.id ? { ...d, stage } : d));
  }

  async function handleSelectDeal(dealId: number) {
    const existing = deals.find(d => d.id === dealId);
    if (existing) { setSelectedDeal(existing); return; }
    const data = await fetch(`/api/crm/deals/${dealId}`).then(r => r.json()) as { deal: Deal };
    if (data.deal) setSelectedDeal(data.deal);
  }

  function handleDealCreated(deal: Deal) {
    setDeals(ds => [deal, ...ds]);
    setShowNewDeal(false);
    setSelectedDeal(deal);
    setToast('Lead oprettet');
    loadUpcoming();
  }

  const openStages  = STAGES.filter(s => s.key !== 'vundet' && s.key !== 'tabt');
  const closedStages = STAGES.filter(s => s.key === 'vundet' || s.key === 'tabt');

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      <NaesteHandlingerPanel upcoming={upcoming} onSelectDeal={handleSelectDeal} />

      {/* Pipeline */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, background: 'var(--s1)' }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>Pipeline</h1>
          <span style={{ fontSize: 12, color: 'var(--t3)' }}>{deals.length} åbne leads</span>
          <div style={{ marginLeft: 'auto' }}>
            <button onClick={() => setShowNewDeal(true)} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600 }}>
              + Nyt lead
            </button>
          </div>
        </div>

        {/* Kanban */}
        <div ref={panelRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', display: 'flex', padding: '16px 16px', gap: 10 }}>
          {loading && <div style={{ color: 'var(--t3)', fontSize: 13, padding: '40px 0', width: '100%', textAlign: 'center' }}>Indlæser…</div>}

          {!loading && openStages.map(stage => {
            const stageDeals = deals.filter(d => d.stage === stage.key);
            const totalVal   = stageDeals.reduce((s, d) => s + (d.value ? Number(d.value) : 0), 0);
            return (
              <div key={stage.key} style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{stage.label}</span>
                  <span style={{ fontSize: 10, color: 'var(--t3)', background: 'var(--s2)', padding: '1px 6px', borderRadius: 100 }}>{stageDeals.length}</span>
                  {totalVal > 0 && <span style={{ fontSize: 10, color: 'var(--gr)', marginLeft: 'auto' }}>{fmt(totalVal)}</span>}
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {stageDeals.map(deal => (
                    <DealCard key={deal.id} deal={deal} selected={selectedDeal?.id === deal.id} onClick={() => setSelectedDeal(selectedDeal?.id === deal.id ? null : deal)} />
                  ))}
                  {stageDeals.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--t4)', textAlign: 'center', padding: '20px 0', border: '1px dashed var(--bd)', borderRadius: 8 }}>Tom</div>
                  )}
                </div>
              </div>
            );
          })}

          {!loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 180, flexShrink: 0 }}>
              {closedStages.map(stage => {
                const stageDeals = deals.filter(d => d.stage === stage.key);
                return (
                  <div key={stage.key}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{stage.label}</span>
                      <span style={{ fontSize: 10, color: 'var(--t3)', background: 'var(--s2)', padding: '1px 6px', borderRadius: 100 }}>{stageDeals.length}</span>
                    </div>
                    {stageDeals.map(deal => (
                      <DealCard key={deal.id} deal={deal} selected={selectedDeal?.id === deal.id} onClick={() => setSelectedDeal(selectedDeal?.id === deal.id ? null : deal)} />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedDeal && (
        <DealPanel
          deal={selectedDeal}
          tasks={tasks}
          onClose={() => setSelectedDeal(null)}
          onStageChange={handleStageChange}
          onUpdated={loadDeals}
        />
      )}

      {showNewDeal && (
        <NewDealModal tasks={tasks} onClose={() => setShowNewDeal(false)} onCreated={handleDealCreated} />
      )}
    </div>
  );
}
