'use client';

import { useEffect, useState } from 'react';

interface Absence {
  id: string;
  type: 'VACATION' | 'SICK' | 'OTHER';
  start_date: string;
  end_date: string;
  note: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
}

const TYPE_DK: Record<string, string> = { VACATION: 'Ferie', SICK: 'Sygdom', OTHER: 'Andet' };
const TYPE_COLOR: Record<string, string> = { VACATION: '#185FA5', SICK: '#E74C3C', OTHER: '#F39C12' };
const STATUS_DK: Record<string, string> = { PENDING: 'Afventer', APPROVED: 'Godkendt', REJECTED: 'Afvist' };
const STATUS_COLOR: Record<string, string> = { PENDING: '#F39C12', APPROVED: '#2ECC71', REJECTED: '#E74C3C' };

const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });

const today = new Date().toISOString().slice(0, 10);

export default function AbsencePage() {
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [type, setType] = useState<'VACATION' | 'SICK' | 'OTHER'>('VACATION');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    const data = await fetch('/api/absences').then(r => r.json());
    setAbsences(data);
  }

  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (endDate < startDate) { setError('Slutdato kan ikke være før startdato'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, start_date: startDate, end_date: endDate, note: note || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Fejl'); return; }
      setNote(''); setType('VACATION'); setStartDate(today); setEndDate(today);
      setSuccess('Anmodning sendt — afventer godkendelse');
      setTimeout(() => setSuccess(''), 4000);
      await load();
    } finally { setSaving(false); }
  }

  async function deleteAbsence(id: string) {
    if (!confirm('Slet denne anmodning?')) return;
    await fetch(`/api/absences/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 760 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 4 }}>Fravær</h1>
      <p style={{ fontSize: 13, color: '#667788', marginBottom: 28 }}>Anmod om ferie, registrer sygdom eller andet fravær</p>

      {/* Form */}
      <form onSubmit={submit} style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '24px 26px', marginBottom: 32 }}>
        <div style={{ fontSize: 12, color: '#667788', letterSpacing: '0.06em', marginBottom: 20 }}>NY FRAVÆRSANMODNING</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#667788', marginBottom: 6, fontWeight: 500 }}>Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as typeof type)}
              style={{ width: '100%', background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#ECF0F1', fontSize: 13, padding: '10px 12px', boxSizing: 'border-box' }}
            >
              <option value="VACATION">Ferie</option>
              <option value="SICK">Sygdom</option>
              <option value="OTHER">Andet fravær</option>
            </select>
          </div>
          <div />
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#667788', marginBottom: 6, fontWeight: 500 }}>Startdato</label>
            <input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value); }}
              style={{ width: '100%', background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#ECF0F1', fontSize: 13, padding: '10px 12px', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#667788', marginBottom: 6, fontWeight: 500 }}>Slutdato</label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={e => setEndDate(e.target.value)}
              style={{ width: '100%', background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#ECF0F1', fontSize: 13, padding: '10px 12px', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#667788', marginBottom: 6, fontWeight: 500 }}>Bemærkning <span style={{ color: '#4A5568', fontWeight: 400 }}>(valgfri)</span></label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            placeholder="Evt. yderligere info…"
            style={{ width: '100%', background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#ECF0F1', fontSize: 13, padding: '10px 12px', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>

        {error && <div style={{ color: '#E74C3C', fontSize: 12, padding: '8px 12px', background: 'rgba(231,76,60,0.1)', borderRadius: 6, marginBottom: 14 }}>{error}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            type="submit"
            disabled={saving}
            style={{ background: '#185FA5', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Sender…' : 'Send anmodning'}
          </button>
          {success && <span style={{ fontSize: 12, color: '#2ECC71' }}>{success}</span>}
        </div>
      </form>

      {/* List */}
      <div style={{ fontSize: 12, color: '#667788', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 14 }}>MINE FRAVÆRSANMODNINGER</div>
      {absences.length === 0 && (
        <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '32px', textAlign: 'center', color: '#667788', fontSize: 13 }}>
          Ingen fraværsanmodninger endnu
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {absences.map(a => (
          <div key={a.id} style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: TYPE_COLOR[a.type], background: `${TYPE_COLOR[a.type]}18`, border: `1px solid ${TYPE_COLOR[a.type]}44`, borderRadius: 4, padding: '2px 8px' }}>
                  {TYPE_DK[a.type]}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLOR[a.status], background: `${STATUS_COLOR[a.status]}18`, border: `1px solid ${STATUS_COLOR[a.status]}44`, borderRadius: 4, padding: '2px 8px' }}>
                  {STATUS_DK[a.status]}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#ECF0F1', fontWeight: 600 }}>
                {fmtDate(a.start_date)}
                {a.end_date !== a.start_date && <> — {fmtDate(a.end_date)}</>}
              </div>
              {a.note && <div style={{ fontSize: 12, color: '#667788', marginTop: 4 }}>{a.note}</div>}
            </div>
            {a.status === 'PENDING' && (
              <button
                onClick={() => deleteAbsence(a.id)}
                style={{ fontSize: 12, color: '#E74C3C', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.2)', padding: '5px 10px', borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Annuller
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
