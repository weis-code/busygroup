'use client';

import { useEffect, useRef, useState } from 'react';
import { flag, countryDisplay, PRIORITY_COUNTRIES, ALL_COUNTRIES } from '@/lib/countries';
import { useRouter } from 'next/navigation';

interface Company {
  id: number;
  name: string;
  title: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  notes: string | null;
  country: string | null;
  industry: string | null;
  website: string | null;
  owner_name: string | null;
  deal_count: number;
  last_activity: string | null;
  created_at: string;
}

const INDUSTRIES = [
  'Tandlæge', 'Fysioterapeut', 'VVS', 'Elektriker', 'Byggeri',
  'Advokat', 'Revisor', 'Klinik', 'Håndværker', 'E-commerce', 'SaaS', 'Andet',
];

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

function CountryPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const filtered = (q ? ALL_COUNTRIES.filter(c => c.name.toLowerCase().includes(q.toLowerCase()) || c.code.toLowerCase().includes(q.toLowerCase())) : ALL_COUNTRIES);
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

export default function CrmCompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filter, setFilter] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', title: '', company_name: '', email: '', phone: '',
    linkedin: '', notes: '', country: 'DK', industry: '', website: '',
  });

  function set(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set('q', filter);
    if (filterCountry) params.set('country', filterCountry);
    if (filterIndustry) params.set('industry', filterIndustry);
    const rows = await fetch(`/api/crm/contacts?${params}`).then(r => r.json()) as Company[];
    if (Array.isArray(rows)) setCompanies(rows);
    setLoading(false);
  }

  useEffect(() => {
    fetch('/api/crm/migrate', { method: 'POST' }).then(() => load());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [filter, filterCountry, filterIndustry]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const res = await fetch('/api/crm/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Ukendt fejl' }));
      setToast(`Fejl: ${body.error ?? 'Kunne ikke oprette virksomhed'}`);
      return;
    }
    setModal(false);
    setForm({ name: '', title: '', company_name: '', email: '', phone: '', linkedin: '', notes: '', country: 'DK', industry: '', website: '' });
    setToast('Virksomhed oprettet');
    load();
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1080 }}>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Mine virksomheder</h1>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>{companies.length} virksomheder</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="/admin/crm" style={{ fontSize: 12, color: 'var(--t3)', textDecoration: 'none', padding: '8px 12px', background: 'var(--s2)', borderRadius: 7, border: '1px solid var(--bd)' }}>← Pipeline</a>
          <button onClick={() => setModal(true)} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>+ Opret virksomhed</button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Søg navn, firma…" style={{ width: 220 }} />
        <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)} style={{ fontSize: 12 }}>
          <option value="">Alle lande</option>
          {ALL_COUNTRIES.map(c => (
            <option key={c.code} value={c.code}>{flag(c.code)} {c.name}</option>
          ))}
        </select>
        <select value={filterIndustry} onChange={e => setFilterIndustry(e.target.value)} style={{ fontSize: 12 }}>
          <option value="">Alle brancher</option>
          {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        {(filterCountry || filterIndustry) && (
          <button onClick={() => { setFilterCountry(''); setFilterIndustry(''); }} style={{ fontSize: 11, color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px' }}>✕ Nulstil</button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 11, overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 100px 120px 160px 80px 120px', gap: 0, padding: '9px 18px', borderBottom: '1px solid var(--bd)', background: 'var(--s2)' }}>
          {['Firma / Kontakt', 'Land', 'Branche', 'Email / Telefon', 'Deals', 'Aktivitet'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
          ))}
        </div>

        {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>}
        {!loading && companies.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Ingen virksomheder</div>
        )}
        {!loading && companies.map((c, idx) => (
          <div key={c.id}
            onClick={() => router.push(`/admin/crm/companies/${c.id}`)}
            style={{ display: 'grid', gridTemplateColumns: '2fr 100px 120px 160px 80px 120px', gap: 0, padding: '13px 18px', borderBottom: idx < companies.length - 1 ? '1px solid var(--bd)' : 'none', cursor: 'pointer', transition: 'background 0.1s', alignItems: 'center' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.015)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>

            {/* Name + subtitle */}
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bl2)', border: '1px solid rgba(79,142,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--bl)', flexShrink: 0 }}>
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{c.name}</div>
                  {(c.title || c.company_name) && (
                    <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>{[c.title, c.company_name].filter(Boolean).join(' · ')}</div>
                  )}
                  {c.website && (
                    <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 1 }}>{c.website.replace(/^https?:\/\//, '')}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Country */}
            <div style={{ fontSize: 13 }}>
              {c.country ? (
                <span title={c.country}>{flag(c.country)}</span>
              ) : <span style={{ color: 'var(--t4)', fontSize: 11 }}>—</span>}
            </div>

            {/* Industry */}
            <div>
              {c.industry ? (
                <span style={{ fontSize: 11, background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 5, padding: '2px 7px', color: 'var(--t2)' }}>{c.industry}</span>
              ) : <span style={{ color: 'var(--t4)', fontSize: 11 }}>—</span>}
            </div>

            {/* Email / Phone */}
            <div style={{ minWidth: 0 }}>
              {c.email && <div style={{ fontSize: 11, color: 'var(--bl)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>}
              {c.phone && <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{c.phone}</div>}
              {!c.email && !c.phone && <span style={{ color: 'var(--t4)', fontSize: 11 }}>—</span>}
            </div>

            {/* Deal count */}
            <div>
              {c.deal_count > 0
                ? <span style={{ fontSize: 12, color: 'var(--bl)', fontWeight: 600 }}>{c.deal_count}</span>
                : <span style={{ fontSize: 11, color: 'var(--t4)' }}>0</span>}
            </div>

            {/* Last activity */}
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>
              {c.last_activity ? timeAgo(c.last_activity) : '—'}
            </div>
          </div>
        ))}
      </div>

      {/* Create company modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div style={{ background: 'var(--s1)', borderRadius: 13, padding: 24, width: 520, maxWidth: '96vw', boxShadow: '0 40px 80px rgba(0,0,0,0.7)', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 6 }}>Opret virksomhed</div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 20 }}>Firmaoplysninger og primær kontakt</div>

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Company info */}
              <div style={{ padding: '14px 16px', background: 'var(--s2)', borderRadius: 9, border: '1px solid var(--bd)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Firmaoplysninger</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div><label>Firmanavn *</label><input value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Firma A/S" /></div>
                  <div><label>Hjemmeside</label><input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://firma.dk" /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label>Branche</label>
                      <select value={form.industry} onChange={e => set('industry', e.target.value)} style={{ fontSize: 12 }}>
                        <option value="">Vælg branche…</option>
                        {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>Land</label>
                      <CountryPicker value={form.country} onChange={v => set('country', v)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Primary contact */}
              <div style={{ padding: '14px 16px', background: 'var(--s2)', borderRadius: 9, border: '1px solid var(--bd)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Primær kontakt</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div><label>Kontaktnavn</label><input value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Jens Jensen" /></div>
                    <div><label>Titel</label><input value={form.title} onChange={e => set('title', e.target.value)} placeholder="CEO" /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div><label>Email</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jens@firma.dk" /></div>
                    <div><label>Telefon</label><input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+45 12 34 56 78" /></div>
                  </div>
                  <div><label>LinkedIn URL</label><input value={form.linkedin} onChange={e => set('linkedin', e.target.value)} placeholder="https://linkedin.com/in/…" /></div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label>Intern note</label>
                <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Notater om virksomheden…" style={{ resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModal(false)} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}>Annuller</button>
                <button type="submit" disabled={saving} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 18px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Opretter…' : 'Opret virksomhed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
