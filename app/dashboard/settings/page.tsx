'use client';

import { useState, FormEvent } from 'react';

export default function SettingsPage() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 8 }}>Indstillinger</h1>
      <p style={{ fontSize: 13, color: '#667788', marginBottom: 32 }}>Skift dit kodeord herunder.</p>

      <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 28 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#ECF0F1', marginBottom: 20 }}>Skift kodeord</div>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: '#667788', display: 'block', marginBottom: 6 }}>Nuværende kodeord</label>
            <input
              type="password"
              value={current}
              onChange={e => setCurrent(e.target.value)}
              required
              autoComplete="current-password"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#667788', display: 'block', marginBottom: 6 }}>Nyt kodeord</label>
            <input
              type="password"
              value={next}
              onChange={e => setNext(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#667788', display: 'block', marginBottom: 6 }}>Bekræft nyt kodeord</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>
          {error && (
            <div style={{ color: '#E74C3C', fontSize: 12, padding: '8px 12px', background: 'rgba(231,76,60,0.1)', borderRadius: 6 }}>{error}</div>
          )}
          {success && (
            <div style={{ color: '#2ECC71', fontSize: 12, padding: '8px 12px', background: 'rgba(46,204,113,0.1)', borderRadius: 6 }}>Kodeord ændret</div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{ padding: '11px 0', borderRadius: 7, background: '#185FA5', color: '#fff', fontWeight: 600, fontSize: 14, marginTop: 4 }}
          >
            {loading ? 'Gemmer…' : 'Skift kodeord'}
          </button>
        </form>
      </div>
    </div>
  );
}
