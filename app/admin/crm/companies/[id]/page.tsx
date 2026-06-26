'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { use } from 'react';
import { flag, countryDisplay, PRIORITY_COUNTRIES, ALL_COUNTRIES } from '@/lib/countries';

interface Company {
  id: number; name: string; title: string | null; company_name: string | null;
  email: string | null; phone: string | null; linkedin: string | null;
  notes: string | null; country: string | null; industry: string | null;
  website: string | null; owner_name: string | null;
}
interface Deal {
  id: number; title: string; value: number | null; stage: string;
  status: string; prospect_name: string | null; won_at: string | null;
  lost_at: string | null; lost_reason: string | null; created_at: string;
  owner_name: string | null;
}
interface Touchpoint {
  id: number; type: string; direction: string | null; title: string;
  body: string | null; outcome: string | null; duration_minutes: number | null;
  next_action: string | null; next_action_date: string | null; next_action_done: boolean;
  extra: Record<string, unknown>; owner_name: string | null; created_at: string;
  deal_title: string | null;
}

const INDUSTRIES = [
  'Tandlæge', 'Fysioterapeut', 'VVS', 'Elektriker', 'Byggeri',
  'Advokat', 'Revisor', 'Klinik', 'Håndværker', 'E-commerce', 'SaaS', 'Andet',
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

function outcomes(type: string): string[] {
  switch (type) {
    case 'call': return CALL_OUTCOMES;
    case 'email': return EMAIL_OUTCOMES;
    case 'meeting': return MEETING_OUTCOMES;
    case 'demo': return DEMO_OUTCOMES;
    case 'follow_up': return FOLLOWUP_OUTCOMES;
    case 'linkedin': return LINKEDIN_OUTCOMES;
    default: return [];
  }
}

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, [onDone]);
  return <div className="toast-container"><div className="toast">{msg}</div></div>;
}

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

function fmt(n: number): string {
  return Number(n).toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' kr';
}

function groupByDate(tps: Touchpoint[]): { label: string; items: Touchpoint[] }[] {
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const weekAgo   = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const groups    = new Map<string, Touchpoint[]>();
  for (const t of tps) {
    const d = t.created_at.slice(0, 10);
    let key: string;
    if (d === today)          key = 'I dag';
    else if (d === yesterday) key = 'I går';
    else if (d >= weekAgo)    key = 'Denne uge';
    else key = new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

function CountryPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const filtered = q ? ALL_COUNTRIES.filter(c => c.name.toLowerCase().includes(q.toLowerCase()) || c.code.toLowerCase().includes(q.toLowerCase())) : ALL_COUNTRIES;
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ width: '100%', textAlign: 'left', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: 'var(--t1)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
        {value ? countryDisplay(value) : <span style={{ color: 'var(--t4)' }}>Vælg land…</span>}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--t4)' }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300, background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', marginTop: 2, maxHeight: 240, overflowY: 'auto' }}>
          <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--bd)', position: 'sticky', top: 0, background: 'var(--s1)' }}>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Søg land…" style={{ width: '100%', fontSize: 12, background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '5px 8px' }} />
          </div>
          {!q && (
            <>
              {PRIORITY_COUNTRIES.map(c => (
                <div key={c.code} onClick={() => { onChange(c.code); setOpen(false); setQ(''); }} style={{ padding: '7px 10px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--t1)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  {flag(c.code)} {c.name}
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--bd)', margin: '2px 0' }} />
            </>
          )}
          {filtered.filter(c => q ? true : !PRIORITY_COUNTRIES.find(p => p.code === c.code)).map(c => (
            <div key={c.code} onClick={() => { onChange(c.code); setOpen(false); setQ(''); }} style={{ padding: '7px 10px', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--t1)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}>
              {flag(c.code)} {c.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LogActivityForm({ contactId, deals, onDone }: { contactId: number; deals: Deal[]; onDone: () => void }) {
  const [type, setType]   = useState('call');
  const [form, setForm]   = useState({ title: '', body: '', outcome: '', duration_minutes: '', next_action: '', next_action_date: '', deal_id: '' });
  const [saving, setSaving] = useState(false);

  function set(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }

  useEffect(() => {
    const meta = TYPE_META[type];
    if (!form.title || Object.values(TYPE_META).some(m => form.title === m.label)) {
      setForm(f => ({ ...f, title: meta?.label ?? '' }));
    }
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const body: Record<string, unknown> = {
      type, contact_id: contactId, title: form.title.trim() || TYPE_META[type]?.label,
      body: form.body || null, outcome: form.outcome || null,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
      next_action: form.next_action || null,
      next_action_date: form.next_action_date || null,
    };
    if (form.deal_id) body.deal_id = Number(form.deal_id);

    await fetch('/api/crm/touchpoints', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    setSaving(false);
    setForm({ title: '', body: '', outcome: '', duration_minutes: '', next_action: '', next_action_date: '', deal_id: '' });
    onDone();
  }

  const outs = outcomes(type);

  return (
    <form onSubmit={submit} style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 2 }}>Log aktivitet</div>

      {/* Type tabs */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {Object.entries(TYPE_META).map(([k, v]) => (
          <button key={k} type="button" onClick={() => setType(k)}
            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--bd)', background: type === k ? 'var(--bl)' : 'var(--s1)', color: type === k ? '#fff' : 'var(--t2)', cursor: 'pointer' }}>
            {v.icon} {v.label}
          </button>
        ))}
      </div>

      <div><label>Titel</label><input value={form.title} onChange={e => set('title', e.target.value)} placeholder={TYPE_META[type]?.label} /></div>

      {outs.length > 0 && (
        <div><label>Udfald</label>
          <select value={form.outcome} onChange={e => set('outcome', e.target.value)} style={{ fontSize: 12 }}>
            <option value="">Vælg udfald…</option>
            {outs.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      )}

      {['call', 'meeting', 'demo'].includes(type) && (
        <div><label>Varighed (minutter)</label><input type="number" min={1} value={form.duration_minutes} onChange={e => set('duration_minutes', e.target.value)} placeholder="30" /></div>
      )}

      <div><label>Note / Referat</label><textarea rows={3} value={form.body} onChange={e => set('body', e.target.value)} placeholder="Hvad skete der?" style={{ resize: 'vertical' }} /></div>

      {deals.length > 0 && (
        <div><label>Tilknyt deal (valgfrit)</label>
          <select value={form.deal_id} onChange={e => set('deal_id', e.target.value)} style={{ fontSize: 12 }}>
            <option value="">Ingen specifik deal</option>
            {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div><label>Næste handling</label><input value={form.next_action} onChange={e => set('next_action', e.target.value)} placeholder="Send tilbud…" /></div>
        <div><label>Dato for handling</label><input type="date" value={form.next_action_date} onChange={e => set('next_action_date', e.target.value)} /></div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" disabled={saving} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 18px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Logger…' : 'Log aktivitet'}
        </button>
      </div>
    </form>
  );
}

export default function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [company, setCompany]     = useState<Company | null>(null);
  const [deals, setDeals]         = useState<Deal[]>([]);
  const [touchpoints, setTps]     = useState<Touchpoint[]>([]);
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState('');
  const [editing, setEditing]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [editForm, setEditForm]   = useState<Partial<Company>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetch(`/api/crm/contacts/${id}`).then(r => r.json()) as {
      contact: Company; deals: Deal[]; touchpoints: Touchpoint[];
    };
    if (data.contact) {
      setCompany(data.contact);
      setEditForm(data.contact);
    }
    setDeals(data.deals ?? []);
    setTps(data.touchpoints ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function setF(k: keyof Company, v: string | null) {
    setEditForm(f => ({ ...f, [k]: v }));
  }

  async function saveEdit() {
    if (!company) return;
    setSaving(true);
    await fetch(`/api/crm/contacts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setSaving(false);
    setEditing(false);
    setToast('Gemt');
    load();
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>;
  }
  if (!company) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--re)', fontSize: 13 }}>Virksomhed ikke fundet</div>;
  }

  const groups = groupByDate(touchpoints);

  const STAGE_LABEL: Record<string, string> = {
    lead: 'Lead', kontaktet: 'Kontaktet', demo: 'Demo', tilbud: 'Tilbud',
    forhandling: 'Forhandling', vundet: 'Vundet', tabt: 'Tabt',
  };
  const STAGE_COLOR: Record<string, string> = {
    vundet: 'var(--gr)', tabt: 'var(--re)',
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1080 }}>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      {/* Back */}
      <a href="/admin/crm/companies" style={{ fontSize: 12, color: 'var(--t3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 18 }}>← Mine virksomheder</a>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Left: Company info card */}
        <div>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden' }}>
            {/* Avatar + name header */}
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--bd)', background: 'var(--s2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--bl2)', border: '1px solid rgba(79,142,247,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: 'var(--bl)', flexShrink: 0 }}>
                  {company.name.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>{company.name}</div>
                  {company.industry && <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{company.industry}</div>}
                  {company.country && <div style={{ fontSize: 12, marginTop: 3 }}>{flag(company.country)} {company.country}</div>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                {editing
                  ? <>
                    <button onClick={saveEdit} disabled={saving} style={{ flex: 1, background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '7px 0', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? 'Gemmer…' : 'Gem'}</button>
                    <button onClick={() => { setEditing(false); setEditForm(company); }} style={{ background: 'var(--s1)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>Annuller</button>
                  </>
                  : <button onClick={() => setEditing(true)} style={{ flex: 1, background: 'var(--s1)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '7px 0', fontSize: 12, cursor: 'pointer' }}>Rediger</button>
                }
              </div>
            </div>

            {/* Fields */}
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {editing ? (
                <>
                  <div><label>Firmanavn</label><input value={editForm.name ?? ''} onChange={e => setF('name', e.target.value)} /></div>
                  <div><label>Hjemmeside</label><input value={editForm.website ?? ''} onChange={e => setF('website', e.target.value)} /></div>
                  <div><label>Branche</label>
                    <select value={editForm.industry ?? ''} onChange={e => setF('industry', e.target.value)} style={{ fontSize: 12 }}>
                      <option value="">Vælg branche…</option>
                      {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div><label>Land</label><CountryPicker value={editForm.country ?? 'DK'} onChange={v => setF('country', v)} /></div>
                  <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Primær kontakt</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div><label>Kontaktnavn</label><input value={editForm.company_name ?? ''} onChange={e => setF('company_name', e.target.value)} /></div>
                      <div><label>Titel</label><input value={editForm.title ?? ''} onChange={e => setF('title', e.target.value)} /></div>
                      <div><label>Email</label><input type="email" value={editForm.email ?? ''} onChange={e => setF('email', e.target.value)} /></div>
                      <div><label>Telefon</label><input value={editForm.phone ?? ''} onChange={e => setF('phone', e.target.value)} /></div>
                      <div><label>LinkedIn</label><input value={editForm.linkedin ?? ''} onChange={e => setF('linkedin', e.target.value)} /></div>
                    </div>
                  </div>
                  <div><label>Intern note</label><textarea rows={3} value={editForm.notes ?? ''} onChange={e => setF('notes', e.target.value)} style={{ resize: 'vertical' }} /></div>
                </>
              ) : (
                <>
                  {company.website && (
                    <Row label="Hjemmeside">
                      <a href={company.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--bl)', textDecoration: 'none' }}>{company.website.replace(/^https?:\/\//, '')}</a>
                    </Row>
                  )}

                  {/* Contact person */}
                  {(company.company_name || company.title || company.email || company.phone || company.linkedin) && (
                    <div style={{ paddingTop: 10, borderTop: '1px solid var(--bd)' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Primær kontakt</div>
                      {company.company_name && <Row label="Navn"><span style={{ fontSize: 12, color: 'var(--t1)' }}>{company.company_name}</span></Row>}
                      {company.title && <Row label="Titel"><span style={{ fontSize: 12, color: 'var(--t2)' }}>{company.title}</span></Row>}
                      {company.email && (
                        <Row label="Email">
                          <a href={`mailto:${company.email}`} style={{ fontSize: 12, color: 'var(--bl)', textDecoration: 'none' }}>{company.email}</a>
                        </Row>
                      )}
                      {company.phone && (
                        <Row label="Telefon">
                          <a href={`tel:${company.phone}`} style={{ fontSize: 12, color: 'var(--bl)', textDecoration: 'none' }}>{company.phone}</a>
                        </Row>
                      )}
                      {company.linkedin && (
                        <Row label="LinkedIn">
                          <a href={company.linkedin} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--bl)', textDecoration: 'none' }}>LinkedIn ↗</a>
                        </Row>
                      )}
                    </div>
                  )}

                  {company.notes && (
                    <div style={{ paddingTop: 10, borderTop: '1px solid var(--bd)' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Note</div>
                      <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{company.notes}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 9, padding: '12px 14px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)' }}>{deals.length}</div>
              <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 2 }}>DEALS</div>
            </div>
            <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 9, padding: '12px 14px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)' }}>{touchpoints.length}</div>
              <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 2 }}>AKTIVITETER</div>
            </div>
          </div>
        </div>

        {/* Right: Deals + Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Deals section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>Deals</div>
              <a
                href={`/admin/crm?contact_id=${id}`}
                style={{ fontSize: 11, color: 'var(--bl)', textDecoration: 'none', padding: '5px 10px', background: 'var(--bl2)', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 6 }}>
                + Ny deal
              </a>
            </div>
            <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, overflow: 'hidden' }}>
              {deals.length === 0 && (
                <div style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--t4)', fontSize: 12 }}>
                  Ingen deals endnu —{' '}
                  <a href={`/admin/crm?contact_id=${id}`} style={{ color: 'var(--bl)', textDecoration: 'none' }}>opret i pipeline</a>
                </div>
              )}
              {deals.map((d, idx) => (
                <a key={d.id} href={`/admin/crm`}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: idx < deals.length - 1 ? '1px solid var(--bd)' : 'none', textDecoration: 'none', transition: 'background 0.1s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.015)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{d.title}</div>
                    {d.prospect_name && <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>{d.prospect_name}</div>}
                  </div>
                  {d.value != null && (
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', flexShrink: 0 }}>{fmt(d.value)}</div>
                  )}
                  <div style={{ flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: STAGE_COLOR[d.stage] ? `${STAGE_COLOR[d.stage]}20` : 'var(--s2)', color: STAGE_COLOR[d.stage] ?? 'var(--t3)', border: `1px solid ${STAGE_COLOR[d.stage] ?? 'var(--bd)'}` }}>
                      {STAGE_LABEL[d.stage] ?? d.stage}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Activity log form */}
          <LogActivityForm contactId={Number(id)} deals={deals} onDone={() => { load(); setToast('Aktivitet logget'); }} />

          {/* Timeline */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 10 }}>Aktivitetshistorik</div>
            {touchpoints.length === 0 && (
              <div style={{ color: 'var(--t4)', fontSize: 12, padding: '16px 0' }}>Ingen aktiviteter endnu</div>
            )}
            {groups.map(group => (
              <div key={group.label} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{group.label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {group.items.map(tp => {
                    const meta = TYPE_META[tp.type] ?? { icon: '📋', label: tp.type };
                    return (
                      <div key={tp.id} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 9, padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 15 }}>{meta.icon}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{tp.title}</span>
                          {tp.deal_title && (
                            <span style={{ fontSize: 10, color: 'var(--bl)', background: 'var(--bl2)', borderRadius: 4, padding: '1px 6px', border: '1px solid rgba(79,142,247,0.2)' }}>{tp.deal_title}</span>
                          )}
                          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--t4)' }}>{timeAgo(tp.created_at)}</span>
                        </div>
                        {tp.outcome && <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: tp.body ? 4 : 0 }}>Udfald: {tp.outcome}</div>}
                        {tp.body && <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{tp.body}</div>}
                        {tp.next_action && (
                          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--t3)' }}>
                            <span>→</span>
                            <span style={{ color: 'var(--ye)' }}>{tp.next_action}</span>
                            {tp.next_action_date && <span style={{ color: 'var(--t4)' }}>{fmtDate(tp.next_action_date)}</span>}
                          </div>
                        )}
                        {tp.owner_name && <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 6 }}>{tp.owner_name}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 70, flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
