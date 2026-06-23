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

const TYPE_DK: Record<string, string> = { VACATION: 'Ferie', SICK: 'Sygdom', OTHER: 'Andet' };
const TYPE_COLOR: Record<string, string> = { VACATION: '#185FA5', SICK: '#E74C3C', OTHER: '#F39C12' };
const STATUS_DK: Record<string, string> = { PENDING: 'Afventer', APPROVED: 'Godkendt', REJECTED: 'Afvist' };
const STATUS_COLOR: Record<string, string> = { PENDING: '#F39C12', APPROVED: '#2ECC71', REJECTED: '#E74C3C' };

const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
const fmtDateTime = (ts: string) => new Date(ts).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
const fmtLong = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export default function PresencePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);

  // New absence form (admin registers on behalf of seller)
  const [showForm, setShowForm] = useState(false);
  const [formUserId, setFormUserId] = useState('');
  const [formType, setFormType] = useState<'VACATION' | 'SICK' | 'OTHER'>('SICK');
  const [formStart, setFormStart] = useState(today);
  const [formEnd, setFormEnd] = useState(today);
  const [formNote, setFormNote] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

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

  // Determine today's absence for each seller
  const todayAbsenceByUser: Record<string, Absence> = {};
  for (const a of absences) {
    if (a.status === 'APPROVED' && a.start_date <= today && a.end_date >= today) {
      todayAbsenceByUser[a.user_id] = a;
    }
  }

  const pending = absences.filter(a => a.status === 'PENDING');

  const clockedIn = entries.filter(e => e.clocked_in_at && !todayAbsenceByUser[e.user_id]);
  const absent = entries.filter(e => todayAbsenceByUser[e.user_id]);
  const notIn = entries.filter(e => !e.clocked_in_at && !todayAbsenceByUser[e.user_id]);

  if (loading) return <div style={{ padding: 40, color: '#667788', fontSize: 13 }}>Indlæser…</div>;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 4 }}>Tilstedeværelse</h1>
          <p style={{ fontSize: 13, color: '#667788' }}>{fmtLong(today)}</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{ background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          + Registrer fravær
        </button>
      </div>

      {/* Register absence form */}
      {showForm && (
        <form onSubmit={submitForm} style={{ background: '#111E2A', border: '1px solid rgba(24,95,165,0.3)', borderRadius: 10, padding: '22px 24px', marginBottom: 28 }}>
          <div style={{ fontSize: 12, color: '#185FA5', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 18 }}>REGISTRER FRAVÆR PÅ VEGNE AF SÆLGER</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#667788', marginBottom: 6 }}>Sælger</label>
              <select value={formUserId} onChange={e => setFormUserId(e.target.value)}
                style={{ width: '100%', background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#ECF0F1', fontSize: 13, padding: '9px 10px', boxSizing: 'border-box' }}>
                <option value="">Vælg…</option>
                {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#667788', marginBottom: 6 }}>Type</label>
              <select value={formType} onChange={e => setFormType(e.target.value as typeof formType)}
                style={{ width: '100%', background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#ECF0F1', fontSize: 13, padding: '9px 10px', boxSizing: 'border-box' }}>
                <option value="SICK">Sygdom</option>
                <option value="VACATION">Ferie</option>
                <option value="OTHER">Andet</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#667788', marginBottom: 6 }}>Fra</label>
              <input type="date" value={formStart} onChange={e => { setFormStart(e.target.value); if (e.target.value > formEnd) setFormEnd(e.target.value); }}
                style={{ width: '100%', background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#ECF0F1', fontSize: 13, padding: '9px 10px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#667788', marginBottom: 6 }}>Til</label>
              <input type="date" value={formEnd} min={formStart} onChange={e => setFormEnd(e.target.value)}
                style={{ width: '100%', background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#ECF0F1', fontSize: 13, padding: '9px 10px', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#667788', marginBottom: 6 }}>Bemærkning <span style={{ color: '#4A5568' }}>(valgfri)</span></label>
            <input value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="Evt. kommentar…"
              style={{ width: '100%', background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#ECF0F1', fontSize: 13, padding: '9px 10px', boxSizing: 'border-box' }} />
          </div>
          {formError && <div style={{ color: '#E74C3C', fontSize: 12, marginBottom: 12 }}>{formError}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={formSaving} style={{ background: '#185FA5', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {formSaving ? 'Gemmer…' : 'Registrer (auto-godkendt)'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={{ background: 'rgba(255,255,255,0.05)', color: '#667788', border: 'none', borderRadius: 7, padding: '9px 16px', fontSize: 13, cursor: 'pointer' }}>
              Annuller
            </button>
          </div>
        </form>
      )}

      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'MØDT IND', value: clockedIn.length, color: '#2ECC71' },
          { label: 'FRAVÆRENDE', value: absent.length, color: '#E74C3C' },
          { label: 'IKKE MØDT IND', value: notIn.length, color: '#667788' },
        ].map(k => (
          <div key={k.label} style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '18px 20px' }}>
            <div style={{ fontSize: 11, color: '#667788', letterSpacing: '0.06em', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: k.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Daily report table */}
      <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, marginBottom: 28, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', fontSize: 12, color: '#667788', letterSpacing: '0.06em', fontWeight: 600 }}>
          DAGLIG RAPPORT — {fmtLong(today).toUpperCase()}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Sælger', 'Status', 'Ind', 'Ud', 'Fravær'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, color: '#667788', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 28, textAlign: 'center', color: '#667788', fontSize: 13 }}>Ingen sælgere fundet</td></tr>
            )}
            {entries.map(e => {
              const absence = todayAbsenceByUser[e.user_id];
              let statusLabel = 'Ikke mødt ind';
              let statusColor = '#667788';
              if (absence) { statusLabel = TYPE_DK[absence.type]; statusColor = TYPE_COLOR[absence.type]; }
              else if (e.clocked_out_at) { statusLabel = 'Stemplet ud'; statusColor = '#185FA5'; }
              else if (e.clocked_in_at) { statusLabel = 'Mødt ind'; statusColor = '#2ECC71'; }

              return (
                <tr key={e.user_id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '13px 20px', fontSize: 13, fontWeight: 600, color: '#ECF0F1' }}>{e.user_name}</td>
                  <td style={{ padding: '13px 20px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}33`, borderRadius: 4, padding: '3px 8px' }}>
                      {statusLabel}
                    </span>
                  </td>
                  <td style={{ padding: '13px 20px', fontSize: 13, color: e.clocked_in_at ? '#ECF0F1' : '#4A5568', fontVariantNumeric: 'tabular-nums' }}>
                    {e.clocked_in_at ? fmtDateTime(e.clocked_in_at) : '—'}
                  </td>
                  <td style={{ padding: '13px 20px', fontSize: 13, color: e.clocked_out_at ? '#ECF0F1' : '#4A5568', fontVariantNumeric: 'tabular-nums' }}>
                    {e.clocked_out_at ? fmtDateTime(e.clocked_out_at) : '—'}
                  </td>
                  <td style={{ padding: '13px 20px', fontSize: 12, color: '#667788' }}>
                    {absence ? `${fmtDate(absence.start_date)}–${fmtDate(absence.end_date)}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pending approvals */}
      {pending.length > 0 && (
        <div style={{ background: '#111E2A', border: '1px solid rgba(243,156,18,0.25)', borderRadius: 10, marginBottom: 28, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', fontSize: 12, color: '#F39C12', letterSpacing: '0.06em', fontWeight: 600 }}>
            AFVENTENDE ANMODNINGER ({pending.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {pending.map((a, i) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#ECF0F1', marginBottom: 3 }}>{a.user_name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: TYPE_COLOR[a.type] }}>{TYPE_DK[a.type]}</span>
                    <span style={{ fontSize: 12, color: '#667788' }}>
                      {fmtDate(a.start_date)}{a.end_date !== a.start_date ? ` – ${fmtDate(a.end_date)}` : ''}
                    </span>
                    {a.note && <span style={{ fontSize: 12, color: '#4A5568', fontStyle: 'italic' }}>"{a.note}"</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setAbsenceStatus(a.id, 'APPROVED')}
                    style={{ fontSize: 12, fontWeight: 600, color: '#2ECC71', background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.25)', padding: '6px 14px', borderRadius: 6, cursor: 'pointer' }}
                  >
                    Godkend
                  </button>
                  <button
                    onClick={() => setAbsenceStatus(a.id, 'REJECTED')}
                    style={{ fontSize: 12, fontWeight: 600, color: '#E74C3C', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.25)', padding: '6px 14px', borderRadius: 6, cursor: 'pointer' }}
                  >
                    Afvis
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All absences */}
      <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', fontSize: 12, color: '#667788', letterSpacing: '0.06em', fontWeight: 600 }}>
          ALLE FRAVÆR ({absences.length})
        </div>
        {absences.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: '#667788', fontSize: 13 }}>Ingen fraværsregistreringer endnu</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Sælger', 'Type', 'Periode', 'Bemærkning', 'Status', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, color: '#667788', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {absences.map((a, i) => (
                <tr key={a.id} style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                  <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, color: '#ECF0F1' }}>{a.user_name}</td>
                  <td style={{ padding: '12px 20px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: TYPE_COLOR[a.type], background: `${TYPE_COLOR[a.type]}18`, borderRadius: 4, padding: '2px 7px' }}>
                      {TYPE_DK[a.type]}
                    </span>
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 13, color: '#ECF0F1', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {fmtDate(a.start_date)}{a.end_date !== a.start_date ? ` – ${fmtDate(a.end_date)}` : ''}
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: 12, color: '#667788', maxWidth: 200 }}>{a.note || '—'}</td>
                  <td style={{ padding: '12px 20px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLOR[a.status], background: `${STATUS_COLOR[a.status]}18`, borderRadius: 4, padding: '2px 7px' }}>
                      {STATUS_DK[a.status]}
                    </span>
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <button
                      onClick={() => deleteAbsence(a.id)}
                      style={{ fontSize: 11, color: '#E74C3C', background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.2)', padding: '3px 9px', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Slet
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
