'use client';

import { useEffect, useState, FormEvent } from 'react';

interface Period { id: string; name: string; start_date: string; end_date: string; created_at: string }

function isActive(p: Period) {
  const today = new Date().toISOString().slice(0, 10);
  return p.start_date <= today && today <= p.end_date;
}

export default function PeriodsPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  async function load() {
    const data = await fetch('/api/admin/periods').then(r => r.json());
    setPeriods(data);
  }

  useEffect(() => { load(); }, []);

  function reset() { setName(''); setStartDate(''); setEndDate(''); setError(''); }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (startDate >= endDate) { setError('Slutdato skal være efter startdato'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/periods', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, start_date: startDate, end_date: endDate }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Fejl'); return; }
      reset(); setOpen(false); load();
    } catch { setError('Netværksfejl'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 4 }}>Lønperioder</h1>
          <p style={{ fontSize: 13, color: '#667788' }}>{periods.length} perioder</p>
        </div>
        <button onClick={() => { reset(); setOpen(true); }} style={{ background: '#185FA5', color: '#fff', padding: '10px 18px', borderRadius: 8, fontWeight: 600, fontSize: 13 }}>+ Ny periode</button>
      </div>

      <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['Navn', 'Start', 'Slut', 'Status'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '14px 18px', fontSize: 11, color: '#667788', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.length === 0 && (
              <tr><td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#667788', fontSize: 13 }}>Ingen perioder endnu</td></tr>
            )}
            {periods.map(p => {
              const active = isActive(p);
              return (
                <tr key={p.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '13px 18px', fontSize: 13, fontWeight: 600, color: '#ECF0F1' }}>{p.name}</td>
                  <td style={{ fontSize: 13, color: '#667788' }}>{p.start_date}</td>
                  <td style={{ fontSize: 13, color: '#667788' }}>{p.end_date}</td>
                  <td>
                    <span style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600,
                      background: active ? 'rgba(46,204,113,0.12)' : 'rgba(255,255,255,0.06)',
                      color: active ? '#2ECC71' : '#667788',
                    }}>{active ? 'Aktiv' : 'Afsluttet'}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1A2A38', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 28, width: 400 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#ECF0F1', marginBottom: 22 }}>Ny lønperiode</div>
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label>Navn</label>
                <input value={name} onChange={e => setName(e.target.value)} required placeholder="F.eks. Juni 2026" />
              </div>
              <div>
                <label>Startdato</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
              </div>
              <div>
                <label>Slutdato</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
              </div>
              {error && <div style={{ color: '#E74C3C', fontSize: 12, padding: '8px 12px', background: 'rgba(231,76,60,0.1)', borderRadius: 6 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setOpen(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 7, background: 'rgba(255,255,255,0.06)', color: '#667788' }}>Annuller</button>
                <button type="submit" disabled={loading} style={{ flex: 2, padding: '10px 0', borderRadius: 7, background: '#185FA5', color: '#fff', fontWeight: 600 }}>
                  {loading ? 'Opretter…' : 'Opret periode'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
