'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { flag, ALL_COUNTRIES, PRIORITY_COUNTRIES } from '@/lib/countries';

interface Stage { id: number; key: string; label: string; color: string; probability: number; position: number; is_won: boolean; is_lost: boolean }
interface DealProduct { id: number; name: string; price: number | null; type: string | null }
interface Deal {
  id: number; title: string; value: number | null; stage: string; status: string;
  prospect_name: string | null; prospect_company: string | null;
  prospect_phone: string | null; prospect_email: string | null;
  country: string | null; notes: string | null; company_id: number | null;
  products: DealProduct[] | null;
  won_at: string | null; lost_at: string | null; lost_reason: string | null;
}
const NLC_COLOR = '#8b5cf6';
const fmt = (n: number) => Number(n).toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' kr';

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, [onDone]);
  return <div className="toast-container"><div className="toast">{msg}</div></div>;
}

function CountryPicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const filtered = query.trim()
    ? ALL_COUNTRIES.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || c.code.toLowerCase().includes(query.toLowerCase()))
    : ALL_COUNTRIES;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '7px 10px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 7, fontSize: 12, color: 'var(--t1)', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
        {value ? <>{flag(value)} {ALL_COUNTRIES.find(c => c.code === value)?.name ?? value}</> : 'Vælg land…'}
        <span style={{ marginLeft: 'auto', opacity: 0.4, fontSize: 10 }}>▼</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 900, background: 'var(--s1)', border: '1px solid var(--bd2)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', marginTop: 4, overflow: 'hidden' }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--bd)' }}>
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Søg land…" style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '5px 8px', fontSize: 12 }} />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {!query.trim() && PRIORITY_COUNTRIES.map(c => (
              <button key={c.code} type="button" onClick={() => { onChange(c.code); setOpen(false); setQuery(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', background: value === c.code ? 'var(--bl2)' : 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--t1)' }}>
                <span>{flag(c.code)}</span> {c.name}
              </button>
            ))}
            {filtered.filter(c => query.trim() || !PRIORITY_COUNTRIES.find(p => p.code === c.code)).map(c => (
              <button key={c.code} type="button" onClick={() => { onChange(c.code); setOpen(false); setQuery(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', background: value === c.code ? 'var(--bl2)' : 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--t1)' }}>
                <span>{flag(c.code)}</span> {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NlcCrmPage() {
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [stages, setStages]       = useState<Stage[]>([]);
  const [deals, setDeals]         = useState<Deal[]>([]);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast]         = useState('');
  const [statusFilter, setStatusFilter] = useState<'open' | 'won' | 'lost'>('open');

  // Create deal form
  const [newTitle, setNewTitle]       = useState('');
  const [newValue, setNewValue]       = useState('');
  const [newStage, setNewStage]       = useState('lead');
  const [newCountry, setNewCountry]   = useState('DK');
  const [newProspect, setNewProspect] = useState('');
  const [newCompany, setNewCompany]   = useState('');
  const [newPhone, setNewPhone]       = useState('');
  const [newEmail, setNewEmail]       = useState('');
  const [newNotes, setNewNotes]       = useState('');
  const [creating, setCreating]       = useState(false);

  // Edit deal
  const [editStage, setEditStage]   = useState('');
  const [editValue, setEditValue]   = useState('');
  const [editTitle, setEditTitle]   = useState('');
  const [editProspect, setEditProspect] = useState('');
  const [editCompany2, setEditCompany2] = useState('');
  const [editPhone, setEditPhone]   = useState('');
  const [editEmail, setEditEmail]   = useState('');
  const [editNotes, setEditNotes]   = useState('');
  const [editCountry, setEditCountry] = useState('DK');
  const [saving, setSaving]         = useState(false);

  const loadDeals = useCallback(async (cId: number) => {
    try {
      const sp = new URLSearchParams({ status: statusFilter, company_id: String(cId) });
      const rows = await fetch(`/api/crm/deals?${sp}`).then(r => r.json()) as Deal[];
      if (Array.isArray(rows)) setDeals(rows);
    } catch { /* ignore */ }
  }, [statusFilter]);

  useEffect(() => {
    async function init() {
      try {
        await fetch('/api/crm/migrate', { method: 'POST' });
      } catch { /* ignore */ }
      const [comps, s] = await Promise.all([
        fetch('/api/companies').then(r => r.json()) as Promise<{ id: number; slug: string }[]>,
        fetch('/api/crm/stages').then(r => r.json()) as Promise<Stage[]>,
      ]);
      const nlc = Array.isArray(comps) ? comps.find(c => c.slug === 'nlc') : null;
      if (!nlc) return;
      setCompanyId(nlc.id);
      if (Array.isArray(s)) setStages(s);
      await loadDeals(nlc.id);
    }
    void init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (companyId !== null) void loadDeals(companyId);
  }, [statusFilter, companyId, loadDeals]);

  function openDeal(d: Deal) {
    setSelectedDeal(d);
    setEditStage(d.stage);
    setEditValue(d.value != null ? String(d.value) : '');
    setEditTitle(d.title);
    setEditProspect(d.prospect_name ?? '');
    setEditCompany2(d.prospect_company ?? '');
    setEditPhone(d.prospect_phone ?? '');
    setEditEmail(d.prospect_email ?? '');
    setEditNotes(d.notes ?? '');
    setEditCountry(d.country ?? 'DK');
  }

  async function saveDeal() {
    if (!selectedDeal) return;
    setSaving(true);
    await fetch(`/api/crm/deals/${selectedDeal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editTitle, value: editValue ? Number(editValue) : null,
        stage: editStage, country: editCountry,
        prospect_name: editProspect || null, prospect_company: editCompany2 || null,
        prospect_phone: editPhone || null, prospect_email: editEmail || null,
        notes: editNotes || null,
      }),
    });
    setSaving(false);
    setSelectedDeal(null);
    setToast('Deal opdateret');
    if (companyId) void loadDeals(companyId);
  }

  async function markWon() {
    if (!selectedDeal) return;
    await fetch(`/api/crm/deals/${selectedDeal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'won', won_at: new Date().toISOString() }) });
    setSelectedDeal(null);
    setToast('Deal markeret som vundet!');
    if (companyId) void loadDeals(companyId);
  }

  async function markLost() {
    if (!selectedDeal) return;
    const reason = prompt('Årsag til tabt deal? (valgfrit)') ?? '';
    await fetch(`/api/crm/deals/${selectedDeal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'lost', lost_at: new Date().toISOString(), lost_reason: reason || null }) });
    setSelectedDeal(null);
    setToast('Deal markeret som tabt');
    if (companyId) void loadDeals(companyId);
  }

  async function createDeal() {
    if (!newTitle.trim() || !companyId) return;
    setCreating(true);
    await fetch('/api/crm/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle, value: newValue ? Number(newValue) : null,
        stage: newStage, country: newCountry,
        prospect_name: newProspect || null, prospect_company: newCompany || null,
        prospect_phone: newPhone || null, prospect_email: newEmail || null,
        notes: newNotes || null, company_id: companyId,
      }),
    });
    setCreating(false);
    setShowCreate(false);
    setNewTitle(''); setNewValue(''); setNewStage('lead'); setNewCountry('DK');
    setNewProspect(''); setNewCompany(''); setNewPhone(''); setNewEmail(''); setNewNotes('');
    setToast('Deal oprettet');
    void loadDeals(companyId);
  }

  async function deleteDeal() {
    if (!selectedDeal || !companyId) return;
    if (!confirm('Slet dette deal?')) return;
    await fetch(`/api/crm/deals/${selectedDeal.id}`, { method: 'DELETE' });
    setSelectedDeal(null);
    setToast('Deal slettet');
    void loadDeals(companyId);
  }

  const activeStages  = stages.filter(s => !s.is_won && !s.is_lost);
  const wonStage      = stages.find(s => s.is_won);
  const pipeline      = deals.filter(d => d.status === 'open').reduce((s, d) => s + Number(d.value ?? 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--bd)', background: 'var(--s1)', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: NLC_COLOR, display: 'inline-block' }} />
            NLC · CRM Pipeline
          </div>
          {pipeline > 0 && <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2, marginLeft: 16 }}>Pipeline: <strong style={{ color: NLC_COLOR }}>{fmt(pipeline)}</strong></div>}
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
          {(['open', 'won', 'lost'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--bd)', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: statusFilter === s ? NLC_COLOR : 'var(--s2)', color: statusFilter === s ? '#fff' : 'var(--t2)' }}>
              {s === 'open' ? 'Aktive' : s === 'won' ? 'Vundet' : 'Tabt'}
            </button>
          ))}
          <button onClick={() => setShowCreate(true)}
            style={{ padding: '6px 16px', background: NLC_COLOR, color: '#fff', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginLeft: 4 }}>
            + Nyt deal
          </button>
        </div>
      </div>

      {/* Kanban pipeline */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', display: 'flex', gap: 0 }}>
        <div style={{ display: 'flex', gap: 12, padding: '16px 20px', minHeight: 0 }}>
          {activeStages.map(stage => {
            const stageDeals = deals.filter(d => d.stage === stage.key);
            const stageVal   = stageDeals.reduce((s, d) => s + Number(d.value ?? 0), 0);
            return (
              <div key={stage.id} style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '8px 12px', borderRadius: '8px 8px 0 0', background: stage.color + '22', borderBottom: `2px solid ${stage.color}`, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: stage.color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{stage.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600 }}>{stageDeals.length}</span>
                  </div>
                  {stageVal > 0 && <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>{fmt(stageVal)}</div>}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stageDeals.map(d => (
                    <div key={d.id} onClick={() => openDeal(d)}
                      style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 9, padding: '11px 13px', cursor: 'pointer', transition: 'border-color 0.12s, transform 0.1s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = NLC_COLOR + '66'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--bd)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', marginBottom: d.prospect_name || d.value ? 6 : 0, lineHeight: 1.3 }}>{d.title}</div>
                      {d.prospect_name && <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 4 }}>{d.prospect_name}{d.prospect_company ? ` · ${d.prospect_company}` : ''}</div>}
                      {d.value != null && (
                        <div style={{ fontSize: 13, fontWeight: 800, color: NLC_COLOR, fontVariantNumeric: 'tabular-nums' }}>{fmt(Number(d.value))}</div>
                      )}
                      {d.country && d.country !== 'DK' && (
                        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>{flag(d.country)} {ALL_COUNTRIES.find(c => c.code === d.country)?.name ?? d.country}</div>
                      )}
                    </div>
                  ))}
                  {stageDeals.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--t4)', fontSize: 11, padding: '20px 0' }}>Ingen deals</div>
                  )}
                </div>
              </div>
            );
          })}

          {wonStage && statusFilter === 'open' && (
            <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', opacity: 0.6 }}>
              <div style={{ padding: '8px 12px', borderRadius: '8px 8px 0 0', background: 'var(--gr2)', borderBottom: '2px solid var(--gr)', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gr)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Vundet</span>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--bd)', borderRadius: 8, color: 'var(--t4)', fontSize: 12, minHeight: 80 }}>
                Træk deal hertil
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deal panel */}
      {selectedDeal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedDeal(null); }}>
          <div style={{ width: 420, maxWidth: '95vw', height: '100%', background: 'var(--s1)', borderLeft: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: NLC_COLOR, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 4 }}>Deal · NLC</div>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)', background: 'transparent', border: 'none', outline: 'none', padding: 0, width: '100%' }} />
              </div>
              <button onClick={() => setSelectedDeal(null)} style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 20, cursor: 'pointer', padding: '0 0 0 12px', flexShrink: 0 }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Stage</label>
                <select value={editStage} onChange={e => setEditStage(e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                  {stages.filter(s => !s.is_lost).map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Værdi (kr)</label>
                <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} placeholder="0" style={{ width: '100%', marginTop: 4 }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Kontaktnavn</label>
                <input value={editProspect} onChange={e => setEditProspect(e.target.value)} placeholder="Navn…" style={{ width: '100%', marginTop: 4 }} />
              </div>
              <div><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Virksomhed</label>
                <input value={editCompany2} onChange={e => setEditCompany2(e.target.value)} placeholder="Virksomhed…" style={{ width: '100%', marginTop: 4 }} />
              </div>
              <div><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Telefon</label>
                <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+45…" style={{ width: '100%', marginTop: 4 }} />
              </div>
              <div><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Email</label>
                <input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="mail@…" style={{ width: '100%', marginTop: 4 }} />
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Land</label>
              <div style={{ marginTop: 4 }}><CountryPicker value={editCountry} onChange={setEditCountry} /></div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Noter</label>
              <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} placeholder="Notater…" style={{ width: '100%', marginTop: 4, resize: 'vertical' }} />
            </div>

            {/* Products */}
            {selectedDeal.products && selectedDeal.products.length > 0 && (
              <div style={{ marginBottom: 16, background: 'var(--s2)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Produkter</div>
                {selectedDeal.products.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--t1)', marginBottom: 4 }}>
                    <span>{p.name}</span>
                    {p.price != null && <span style={{ color: 'var(--gr)', fontWeight: 600 }}>{fmt(Number(p.price))}{p.type === 'monthly' ? '/md.' : ''}</span>}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--bd)' }}>
              <button onClick={() => void saveDeal()} disabled={saving} style={{ flex: 1, background: NLC_COLOR, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Gemmer…' : 'Gem'}
              </button>
              <button onClick={() => void markWon()} style={{ padding: '9px 14px', background: 'var(--gr2)', color: 'var(--gr)', border: '1px solid var(--gr)', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Vundet</button>
              <button onClick={() => void markLost()} style={{ padding: '9px 14px', background: 'var(--re2)', color: 'var(--re)', border: '1px solid var(--re)', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Tabt</button>
              <button onClick={() => void deleteDeal()} style={{ padding: '9px 10px', background: 'none', color: 'var(--re)', border: '1px solid var(--bd)', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>🗑</button>
            </div>

            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <a href="/admin/crm" style={{ fontSize: 11, color: 'var(--t3)' }}>Åbn i fuld CRM →</a>
            </div>
          </div>
        </div>
      )}

      {/* Create deal modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div style={{ background: 'var(--s1)', borderRadius: 13, padding: 24, width: 440, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: NLC_COLOR, display: 'inline-block' }} />
              Nyt deal · NLC
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><label>Titel *</label><input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Dealets navn…" autoFocus /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label>Værdi (kr)</label><input type="number" value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="0" /></div>
                <div><label>Stage</label>
                  <select value={newStage} onChange={e => setNewStage(e.target.value)}>
                    {activeStages.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <div><label>Kontaktnavn</label><input value={newProspect} onChange={e => setNewProspect(e.target.value)} placeholder="Navn…" /></div>
                <div><label>Virksomhed</label><input value={newCompany} onChange={e => setNewCompany(e.target.value)} placeholder="Virksomhed…" /></div>
                <div><label>Telefon</label><input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+45…" /></div>
                <div><label>Email</label><input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="mail@…" /></div>
              </div>
              <div><label>Land</label><div style={{ marginTop: 4 }}><CountryPicker value={newCountry} onChange={setNewCountry} /></div></div>
              <div><label>Noter</label><textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} rows={2} placeholder="Notater…" style={{ resize: 'vertical' }} /></div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreate(false)} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 16px', fontSize: 12 }}>Annuller</button>
              <button onClick={() => void createDeal()} disabled={creating || !newTitle.trim()} style={{ background: NLC_COLOR, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {creating ? 'Opretter…' : 'Opret deal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast} onDone={() => setToast('')} />}
    </div>
  );
}
