'use client';

import { useEffect, useState } from 'react';

interface Absence {
  id: string;
  type: 'VACATION' | 'SICK' | 'OTHER';
  start_date: string; end_date: string;
  note: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
}

const TYPE_DK: Record<string, string>     = { VACATION: 'Ferie', SICK: 'Sygdom', OTHER: 'Andet' };
const TYPE_BADGE: Record<string, string>  = { VACATION: 'badge-blue', SICK: 'badge-red', OTHER: 'badge-yellow' };
const STATUS_DK: Record<string, string>   = { PENDING: 'Afventer', APPROVED: 'Godkendt', REJECTED: 'Afvist' };
const STATUS_BADGE: Record<string, string> = { PENDING: 'badge-yellow', APPROVED: 'badge-green', REJECTED: 'badge-red' };

const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
const today = new Date().toISOString().slice(0, 10);

export default function AbsencePage() {
  const [absences, setAbsences]   = useState<Absence[]>([]);
  const [type, setType]           = useState<'VACATION' | 'SICK' | 'OTHER'>('VACATION');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate]     = useState(today);
  const [note, setNote]           = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Fravær</h1>
        <p style={{ fontSize: 12, color: 'var(--t3)' }}>Anmod om ferie, registrer sygdom eller andet fravær</p>
      </div>

      {/* Form */}
      <form onSubmit={submit} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '24px 26px', marginBottom: 28 }}>
        <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20 }}>Ny fraværsanmodning</div>
        <div className="form-grid-2" style={{ marginBottom: 16 }}>
          <div className="form-group">
            <label>Type</label>
            <select value={type} onChange={e => setType(e.target.value as typeof type)}>
              <option value="VACATION">Ferie</option>
              <option value="SICK">Sygdom</option>
              <option value="OTHER">Andet fravær</option>
            </select>
          </div>
          <div />
          <div className="form-group">
            <label>Startdato</label>
            <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value); }} />
          </div>
          <div className="form-group">
            <label>Slutdato</label>
            <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label>Bemærkning (valgfri)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Evt. yderligere info…" />
        </div>
        {error && <div className="alert-error" style={{ marginBottom: 14 }}>{error}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Sender…' : 'Send anmodning'}
          </button>
          {success && <span style={{ fontSize: 12, color: 'var(--gr)', fontWeight: 600 }}>{success}</span>}
        </div>
      </form>

      {/* List */}
      <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>Mine fraværsanmodninger</div>
      {absences.length === 0 && (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '32px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
          Ingen fraværsanmodninger endnu
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {absences.map(a => (
          <div key={a.id} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span className={`badge ${TYPE_BADGE[a.type]}`}>{TYPE_DK[a.type]}</span>
                <span className={`badge ${STATUS_BADGE[a.status]}`}>{STATUS_DK[a.status]}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--t1)', fontWeight: 600 }}>
                {fmtDate(a.start_date)}
                {a.end_date !== a.start_date && <> — {fmtDate(a.end_date)}</>}
              </div>
              {a.note && <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>{a.note}</div>}
            </div>
            {a.status === 'PENDING' && (
              <button onClick={() => deleteAbsence(a.id)} className="btn btn-danger btn-sm" style={{ whiteSpace: 'nowrap' }}>Annuller</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
