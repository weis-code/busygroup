'use client';

import { useState, FormEvent } from 'react';

export default function SettingsPage() {
  const [current, setCurrent] = useState('');
  const [next, setNext]       = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(''); setSuccess(false);
    if (next !== confirm) { setError('De nye kodeord matcher ikke'); return; }
    if (next.length < 8) { setError('Kodeord skal være mindst 8 tegn'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Fejl'); return; }
      setSuccess(true);
      setCurrent(''); setNext(''); setConfirm('');
    } catch { setError('Netværksfejl'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 480 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Indstillinger</h1>
        <p style={{ fontSize: 12, color: 'var(--t3)' }}>Skift dit kodeord herunder.</p>
      </div>

      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: 28 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 22 }}>Skift kodeord</div>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label>Nuværende kodeord</label>
            <input type="password" value={current} onChange={e => setCurrent(e.target.value)} required autoComplete="current-password" />
          </div>
          <div className="form-group">
            <label>Nyt kodeord</label>
            <input type="password" value={next} onChange={e => setNext(e.target.value)} required minLength={8} autoComplete="new-password" />
          </div>
          <div className="form-group">
            <label>Bekræft nyt kodeord</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" />
          </div>
          {error && <div className="alert-error">{error}</div>}
          {success && <div style={{ color: 'var(--gr)', fontSize: 12, padding: '9px 13px', background: 'var(--gr2)', border: '1px solid rgba(45,212,160,0.2)', borderRadius: 6, fontWeight: 500 }}>Kodeord ændret</div>}
          <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: 4, padding: '11px 0', fontSize: 14 }}>
            {loading ? 'Gemmer…' : 'Skift kodeord'}
          </button>
        </form>
      </div>
    </div>
  );
}
