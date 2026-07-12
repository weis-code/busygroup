'use client';

import { useEffect, useState, useCallback } from 'react';

interface Absence {
  id: string; user_id: string; user_name: string;
  type: string; start_date: string; end_date: string;
  note: string | null; status: string; created_by_name: string;
  company_name: string | null; company_slug: string | null;
}
interface Seller { id: string; name: string; company_name: string | null; company_slug: string | null }
interface Company { id: number; name: string; slug: string }

const TYPE_DK: Record<string, string>   = { VACATION: 'Ferie', SICK: 'Sygdom', OTHER: 'Andet' };
const TYPE_CLR: Record<string, string>  = { VACATION: 'var(--bl)', SICK: 'var(--re)', OTHER: 'var(--ye)' };
const TYPE_BG: Record<string, string>   = { VACATION: 'var(--bl2)', SICK: 'var(--re2)', OTHER: 'var(--ye2)' };
const STATUS_DK: Record<string, string> = { PENDING: 'Afventer', APPROVED: 'Godkendt', REJECTED: 'Afvist' };
const STATUS_CLR: Record<string, string>= { PENDING: 'var(--ye)', APPROVED: 'var(--gr)', REJECTED: 'var(--re)' };
const STATUS_BG: Record<string, string> = { PENDING: 'var(--ye2)', APPROVED: 'var(--gr2)', REJECTED: 'var(--re2)' };

const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });

export default function GroupAbsencePage() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const today = now.toISOString().slice(0, 10);

  const [absences, setAbsences] = useState<Absence[]>([]);
  const [sellers, setSellers]   = useState<Seller[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filterCompany, setFilterCompany] = useState('');
  const [filterStatus, setFilterStatus]   = useState('');
  const [month, setMonth]       = useState(currentMonth);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formUserId, setFormUserId] = useState('');
  const [formType, setFormType]     = useState('SICK');
  const [formStart, setFormStart]   = useState(today);
  const [formEnd, setFormEnd]       = useState(today);
  const [formNote, setFormNote]     = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [ab, sel, comp] = await Promise.all([
      fetch('/api/absences').then(r => r.json()),
      fetch('/api/admin/sellers').then(r => r.json()),
      fetch('/api/companies').then(r => r.json()),
    ]);
    setAbsences(Array.isArray(ab) ? ab : []);
    setSellers(Array.isArray(sel) ? sel as Seller[] : []);
    setCompanies(Array.isArray(comp) ? comp : []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submitAbsence() {
    if (!formUserId || !formStart || !formEnd) { setError('Udfyld alle felter'); return; }
    setSaving(true); setError('');
    const res = await fetch('/api/absences', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: formUserId, type: formType, start_date: formStart, end_date: formEnd, note: formNote || null }),
    });
    if (!res.ok) { const d = await res.json() as { error?: string }; setError(d.error ?? 'Fejl'); setSaving(false); return; }
    setSaving(false); setShowForm(false); setFormUserId(''); setFormNote('');
    await load();
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/absences/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    await load();
  }

  const pendingCount = absences.filter(a => a.status === 'PENDING').length;

  const filtered = absences
    .filter(a => {
      if (filterCompany && a.company_slug !== filterCompany) return false;
      if (month && !a.start_date.startsWith(month)) return false;
      if (filterStatus && a.status !== filterStatus) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
      return 0;
    });

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 3 }}>Fravær · Alle virksomheder</h1>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>Konsolideret fraværsoversigt</div>
        </div>
        <button onClick={() => setShowForm(true)} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
          + Registrer fravær
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          style={{ padding: '7px 12px', fontSize: 12, width: 'auto' }} />
        <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} style={{ width: 'auto', padding: '7px 12px', fontSize: 12 }}>
          <option value="">Alle virksomheder</option>
          {companies.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
        {(['', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(s => {
          const labels: Record<string, string> = { '': 'Alle', PENDING: 'Afventer', APPROVED: 'Godkendt', REJECTED: 'Afvist' };
          const active = filterStatus === s;
          return (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 500,
              border: `1.5px solid ${active ? 'var(--bl)' : 'var(--bd)'}`,
              background: active ? 'var(--bl2)' : 'transparent',
              color: active ? 'var(--bl)' : 'var(--t2)', cursor: 'pointer',
            }}>{labels[s]}</button>
          );
        })}
        {pendingCount > 0 && (
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ye)', background: 'var(--ye2)', padding: '4px 10px', borderRadius: 6, marginLeft: 4 }}>
            ⚠ {pendingCount} afventer
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ color: 'var(--t3)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Indlæser…</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: 'var(--t3)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Ingen fraværsregistreringer</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(a => (
            <div key={a.id} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: TYPE_CLR[a.type], background: TYPE_BG[a.type], padding: '3px 8px', borderRadius: 5, letterSpacing: '0.06em', flexShrink: 0 }}>{TYPE_DK[a.type] ?? a.type}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {a.user_name}
                  {a.company_name && <span style={{ fontSize: 10, color: 'var(--t3)', background: 'var(--s2)', border: '1px solid var(--bd)', padding: '1px 6px', borderRadius: 4 }}>{a.company_name}</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{fmtDate(a.start_date)} – {fmtDate(a.end_date)}{a.note ? ` · ${a.note}` : ''}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_CLR[a.status], background: STATUS_BG[a.status], padding: '2px 8px', borderRadius: 4, flexShrink: 0 }}>{STATUS_DK[a.status] ?? a.status}</span>
              {a.status === 'PENDING' && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => void updateStatus(a.id, 'APPROVED')} style={{ background: 'var(--gr2)', color: 'var(--gr)', border: '1px solid var(--gr)', borderRadius: 5, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Godkend</button>
                  <button onClick={() => void updateStatus(a.id, 'REJECTED')} style={{ background: 'var(--re2)', color: 'var(--re)', border: '1px solid var(--re)', borderRadius: 5, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Afvis</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="modal-box" style={{ background: 'var(--s1)', borderRadius: 13, padding: 24, width: 400, maxWidth: '94vw' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 18 }}>Registrer fravær</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label>Medarbejder</label><select value={formUserId} onChange={e => setFormUserId(e.target.value)}><option value="">— Vælg —</option>{sellers.map(s => <option key={s.id} value={s.id}>{s.name}{s.company_name ? ` (${s.company_name})` : ''}</option>)}</select></div>
              <div><label>Type</label><select value={formType} onChange={e => setFormType(e.target.value)}><option value="SICK">Sygdom</option><option value="VACATION">Ferie</option><option value="OTHER">Andet</option></select></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label>Fra</label><input type="date" value={formStart} onChange={e => setFormStart(e.target.value)} /></div>
                <div><label>Til</label><input type="date" value={formEnd} onChange={e => setFormEnd(e.target.value)} /></div>
              </div>
              <div><label>Note (valgfrit)</label><input value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="Kort beskrivelse" /></div>
              {error && <div style={{ fontSize: 12, color: 'var(--re)', background: 'var(--re2)', padding: '8px 12px', borderRadius: 6 }}>{error}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12 }}>Annuller</button>
              <button onClick={() => void submitAbsence()} disabled={saving} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600 }}>{saving ? 'Gemmer…' : 'Gem'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
