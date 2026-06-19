'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
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
      router.push(data.role === 'SELLER' ? '/dashboard' : '/admin');
    } catch {
      setError('Netværksfejl — prøv igen');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0F1923',
    }}>
      <div style={{
        width: 380, background: '#111E2A',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12, padding: '36px 32px',
      }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#185FA5', letterSpacing: '0.06em' }}>NEXT LEVEL SALES</div>
          <div style={{ fontSize: 13, color: '#667788', marginTop: 6 }}>Log ind på dit dashboard</div>
        </div>

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="din@email.dk" required autoFocus
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label>Kodeord</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
            />
          </div>

          {error && (
            <div style={{
              marginBottom: 16, padding: '10px 14px', borderRadius: 6,
              background: 'rgba(231,76,60,0.12)', border: '1px solid rgba(231,76,60,0.3)',
              color: '#E74C3C', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '11px 0', borderRadius: 7,
            background: '#185FA5', color: '#fff', fontWeight: 600, fontSize: 14,
          }}>
            {loading ? 'Logger ind…' : 'Log ind'}
          </button>
        </form>
      </div>
    </div>
  );
}
