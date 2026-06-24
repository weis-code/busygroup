'use client';

import { useEffect, useState, useCallback } from 'react';

interface TimeEntry {
  id?: string;
  user_id: string;
  user_name: string;
  clocked_in_at: string | null;
  clocked_out_at: string | null;
}

interface Absence {
  id: string;
  user_id: string;
  user_name: string;
  type: 'VACATION' | 'SICK' | 'OTHER';
  start_date: string;
  end_date: string;
  note: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_by_name: string;
}

interface Seller { id: string; name: string; email: string; role: string }

const TYPE_DK: Record<string, string>    = { VACATION: 'Ferie', SICK: 'Sygdom', OTHER: 'Andet' };
const TYPE_CLR: Record<string, string>   = { VACATION: 'var(--bl)', SICK: 'var(--re)', OTHER: 'var(--ye)' };
const TYPE_BG: Record<string, string>    = { VACATION: 'var(--bl2)', SICK: 'var(--re2)', OTHER: 'var(--ye2)' };
const STATUS_DK: Record<string, string>  = { PENDING: 'Afventer', APPROVED: 'Godkendt', REJECTED: 'Afvist' };
const STATUS_CLR: Record<string, string> = { PENDING: 'var(--ye)', APPROVED: 'var(--gr)', REJECTED: 'var(--re)' };
const STATUS_BG: Record<string, string>  = { PENDING: 'var(--ye2)', APPROVED: 'var(--gr2)', REJECTED: 'var(--re2)' };

const fmtDate     = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
const fmtDateTime = (ts: string) => new Date(ts).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
const fmtLong     = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export default function PresencePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [entries, setEntries]   = useState<TimeEntry[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [sellers, setSellers]   = useState<Seller[]>([]);
  const [loading, setLoading]   = useState(true);

  const [showForm, setShowForm]     = useState(false);
  const [formUserId, setFormUserId] = useState('');
  const [formType, setFormType]     = useState<'VACATION' | 'SICK' | 'OTHER'>('SICK');
  const [formStart, setFormStart]   = useState(today);
  const [formEnd, setFormEnd]       = useState(today);
  const [formNote, setFormNote]     = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [teRes, abRes, selRes] = await Promise.all([
      fetch('/api/time-entries').then(r => r.json()),
      fetch('/api/absences').then(r => r.json()),
      fetch('/api/admin/sellers').then(r => r.json()),
    ]);
    setEntries(teRes.entries ?? []);
    setAbsences(abRes);
    setSellers((selRes as Seller[]).filter(s => s.role === 'SELLER'));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setAbsenceStatus(id: string, status: 'APPROVED' | 'REJECTED') {
    await fetch(`/api/absences/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function deleteAbsence(id: string) {
    if (!confirm('Slet dette fravær?')) return;
    await fetch(`/api/absences/${id}`, { method: 'DELETE' });
    await load();
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!formUserId) { setFormError('Vælg en sælger'); return; }
    setFormSaving(true);
    const res = await fetch('/api/absences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: formUserId, type: formType, start_date: formStart, end_date: formEnd, note: formNote || null }),
    });
    const data = await res.json();
    setFormSaving(false);
    if (!res.ok) { setFormError(data.error || 'Fejl'); return; }
    setShowForm(false); setFormUserId(''); setFormType('SICK'); setFormStart(today); setFormEnd(today); setFormNote('');
    await load();
  }

  const todayAbsenceByUser: Record<string, Absence> = {};
  for (const a of absences) {
    if (a.status === 'APPROVED' && a.start_date <= today && a.end_date >= today) {
      todayAbsenceByUser[a.user_id] = a;
    }
  }

  const pending   = absences.filter(a => a.status === 'PENDING');
  const clockedIn = entries.filter(e => e.clocked_in_at && !todayAbsenceByUser[e.user_id]);
  const absent    = entries.filter(e => todayAbsenceByUser[e.user_id]);
  const notIn     = entries.filter(e => !e.clocked_in_at && !todayAbsenceByUser[e.user_id]);

  if (loading) return <div style={{ padding: 40, color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tilstedeværelse</h1>
          <p className="page-sub">{fmtLong(today)}</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn btn-primary">
          + Registrer fravær
        </button>
      </div>

      {showForm && (
        <form onSubmit={submitForm} style={{ background: 'var(--s1)', border: '1px solid var(--bd2)', borderRadius: 10, padding: '22px 24px', marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: 'var(--bl)', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 18, textTransform: 'uppercase' }}>Registrer fravær på vegne af sælger</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div className="form-group">
              <label>Sælger</label>
              <select value={formUserId} onChange={e => setFormUserId(e.target.value)}>
                <option value="">Vælg…</option>
                {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Type</label>
              <select value={formType} onChange={e => setFormType(e.target.value as typeof formType)}>
                <option value="SICK">Sygdom</option>
                <option value="VACATION">Ferie</option>
                <option value="OTHER">Andet</option>
              </select>
            </div>
            <div className="form-group">
              <label>Fra</label>
              <input type="date" value={formStart} onChange={e => { setFormStart(e.target.value); if (e.target.value > formEnd) setFormEnd(e.target.value); }} />
            </div>
            <div className="form-group">
              <label>Til</label>
              <input type="date" value={formEnd} min={formStart} onChange={e => setFormEnd(e.target.value)} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Bemærkning <span style={{ color: 'var(--t4)', fontWeight: 400 }}>(valgfri)</span></label>
            <input value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="Evt. kommentar…" />
          </div>
          {formError && <div className="alert-error" style={{ marginBottom: 12 }}>{formError}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={formSaving} className="btn btn-primary">
              {formSaving ? 'Gemmer…' : 'Registrer (auto-godkendt)'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost">Annuller</button>
          </div>
        </form>
      )}

      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Mødt ind',        value: clockedIn.length, accent: 'var(--gr)' },
          { label: 'Fraværende',      value: absent.length,    accent: 'var(--re)' },
          { label: 'Ikke mødt ind',   value: notIn.length,     accent: 'var(--t3)' },
        ].map(k => (
          <div key={k.label} className="kpi-tile" style={{ '--accent': k.accent } as React.CSSProperties}>
            <div className="kpi-label">{k.label}</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: k.accent, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Daily report */}
      <div className="table-wrap" style={{ marginBottom: 28 }}>
        <div className="card-header">Daglig rapport — {fmtLong(today)}</div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>{['Sælger', 'Status', 'Ind', 'Ud', 'Fravær'].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr className="empty-row"><td colSpan={5}>Ingen sælgere fundet</td></tr>
              )}
              {entries.map(e => {
                const absence = todayAbsenceByUser[e.user_id];
                let statusLabel = 'Ikke mødt ind';
                let statusColor = 'var(--t3)';
                let statusBg    = 'var(--bd)';
                if (absence) { statusLabel = TYPE_DK[absence.type]; statusColor = TYPE_CLR[absence.type]; statusBg = TYPE_BG[absence.type]; }
                else if (e.clocked_out_at) { statusLabel = 'Stemplet ud'; statusColor = 'var(--bl)'; statusBg = 'var(--bl2)'; }
                else if (e.clocked_in_at)  { statusLabel = 'Mødt ind';    statusColor = 'var(--gr)'; statusBg = 'var(--gr2)'; }

                return (
                  <tr key={e.user_id}>
                    <td className="td-primary">{e.user_name}</td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 700, color: statusColor, background: statusBg, borderRadius: 4, padding: '3px 8px' }}>
                        {statusLabel}
                      </span>
                    </td>
                    <td style={{ color: e.clocked_in_at ? 'var(--t1)' : 'var(--t4)', fontVariantNumeric: 'tabular-nums' }}>
                      {e.clocked_in_at ? fmtDateTime(e.clocked_in_at) : '—'}
                    </td>
                    <td style={{ color: e.clocked_out_at ? 'var(--t1)' : 'var(--t4)', fontVariantNumeric: 'tabular-nums' }}>
                      {e.clocked_out_at ? fmtDateTime(e.clocked_out_at) : '—'}
                    </td>
                    <td style={{ color: 'var(--t3)' }}>
                      {absence ? `${fmtDate(absence.start_date)}–${fmtDate(absence.end_date)}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending approvals */}
      {pending.length > 0 && (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--ye)', borderRadius: 10, marginBottom: 28, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bd)', fontSize: 11, color: 'var(--ye)', letterSpacing: '0.06em', fontWeight: 700, textTransform: 'uppercase' }}>
            Afventende anmodninger ({pending.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {pending.map((a, i) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', borderTop: i > 0 ? '1px solid var(--bd)' : undefined }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 3 }}>{a.user_name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: TYPE_CLR[a.type] }}>{TYPE_DK[a.type]}</span>
                    <span style={{ fontSize: 12, color: 'var(--t3)' }}>
                      {fmtDate(a.start_date)}{a.end_date !== a.start_date ? ` – ${fmtDate(a.end_date)}` : ''}
                    </span>
                    {a.note && <span style={{ fontSize: 12, color: 'var(--t4)', fontStyle: 'italic' }}>&ldquo;{a.note}&rdquo;</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setAbsenceStatus(a.id, 'APPROVED')} className="btn btn-sm" style={{ color: 'var(--gr)', background: 'var(--gr2)', border: '1px solid rgba(45,212,160,0.25)' }}>
                    Godkend
                  </button>
                  <button onClick={() => setAbsenceStatus(a.id, 'REJECTED')} className="btn btn-sm btn-danger">
                    Afvis
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All absences */}
      <div className="table-wrap">
        <div className="card-header">Alle fravær ({absences.length})</div>
        {absences.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Ingen fraværsregistreringer endnu</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>{['Sælger', 'Type', 'Periode', 'Bemærkning', 'Status', ''].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {absences.map(a => (
                  <tr key={a.id}>
                    <td className="td-primary">{a.user_name}</td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 700, color: TYPE_CLR[a.type], background: TYPE_BG[a.type], borderRadius: 4, padding: '2px 7px' }}>
                        {TYPE_DK[a.type]}
                      </span>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {fmtDate(a.start_date)}{a.end_date !== a.start_date ? ` – ${fmtDate(a.end_date)}` : ''}
                    </td>
                    <td style={{ color: 'var(--t3)', maxWidth: 200 }}>{a.note || '—'}</td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_CLR[a.status], background: STATUS_BG[a.status], borderRadius: 4, padding: '2px 7px' }}>
                        {STATUS_DK[a.status]}
                      </span>
                    </td>
                    <td>
                      <button onClick={() => deleteAbsence(a.id)} className="btn btn-sm btn-danger">Slet</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
