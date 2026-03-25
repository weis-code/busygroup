'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login fejlede'); return; }
      router.push('/');
      router.refresh();
    } catch {
      setError('Netværksfejl — prøv igen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0A1219', padding: '20px',
    }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#ECF0F1', marginBottom: '4px' }}>BusyGroup</div>
          <div style={{ fontSize: '13px', color: '#667788' }}>Agent Dashboard</div>
        </div>

        {/* Card */}
        <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '28px' }}>
          <h1 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 700, color: '#ECF0F1' }}>Log ind</h1>

          <form onSubmit={handleSubmit}>
            <label style={{ display: 'block', fontSize: '12px', color: '#667788', marginBottom: '6px' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="navn@busyconsulting.dk"
              required
              autoFocus
              style={{
                width: '100%', padding: '10px 12px', background: '#0F1923',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: '7px',
                color: '#ECF0F1', fontSize: '13px', outline: 'none',
                boxSizing: 'border-box', marginBottom: '14px',
              }}
            />

            <label style={{ display: 'block', fontSize: '12px', color: '#667788', marginBottom: '6px' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%', padding: '10px 12px', background: '#0F1923',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: '7px',
                color: '#ECF0F1', fontSize: '13px', outline: 'none',
                boxSizing: 'border-box', marginBottom: error ? '10px' : '20px',
              }}
            />

            {error && (
              <div style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.25)', borderRadius: '6px', padding: '9px 12px', color: '#E74C3C', fontSize: '12px', marginBottom: '16px' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '11px', background: loading ? 'rgba(24,95,165,0.5)' : '#185FA5',
                border: 'none', borderRadius: '7px', color: '#ECF0F1',
                fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {loading ? 'Logger ind...' : 'Log ind'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: '#445566' }}>
          BusyConsulting · Kun autoriseret personale
        </p>
      </div>
    </div>
  );
}
