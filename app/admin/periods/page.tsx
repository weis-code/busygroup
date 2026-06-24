'use client';

import { useEffect, useState, FormEvent } from 'react';

interface Period { id: string; name: string; start_date: string; end_date: string; created_at: string }

function isActive(p: Period) {
  const today = new Date().toISOString().slice(0, 10);
  return p.start_date <= today && today <= p.end_date;
}

export default function PeriodsPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [name, setName]       = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');

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
      <div className="page-header">
        <div>
          <h1 className="page-title">Lønperioder</h1>
          <p className="page-sub">{periods.length} perioder</p>
        </div>
        <button onClick={() => { reset(); setOpen(true); }} className="btn btn-primary">+ Ny periode</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>{['Navn', 'Start', 'Slut', 'Status'].map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {periods.length === 0 && (
              <tr className="empty-row"><td colSpan={4}>Ingen perioder endnu</td></tr>
            )}
            {periods.map(p => {
              const active = isActive(p);
              return (
                <tr key={p.id}>
                  <td className="td-primary">{p.name}</td>
                  <td>{p.start_date}</td>
                  <td>{p.end_date}</td>
                  <td>
                    <span className={`badge ${active ? 'badge-green' : 'badge-muted'}`}>
                      {active ? 'Aktiv' : 'Afsluttet'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-title">Ny lønperiode</div>
            <form onSubmit={onSubmit} className="modal-form">
              <div className="form-group">
                <label>Navn</label>
                <input value={name} onChange={e => setName(e.target.value)} required placeholder="F.eks. Juni 2026" />
              </div>
              <div className="form-group">
                <label>Startdato</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Slutdato</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
              </div>
              {error && <div className="alert-error">{error}</div>}
              <div className="modal-footer">
                <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost" style={{ flex: 1 }}>Annuller</button>
                <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 2 }}>
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
