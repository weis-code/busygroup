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
      background: 'var(--bg)',
      backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(79,142,247,0.08) 0%, transparent 60%)',
    }}>
      <div style={{ width: 400, padding: '0 16px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, margin: '0 auto 16px',
            background: 'var(--bl2)', border: '1px solid rgba(79,142,247,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 15 15" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1.5" fill="var(--bl)" />
              <rect x="9" y="1" width="5" height="5" rx="1.5" fill="var(--bl)" opacity=".6" />
              <rect x="1" y="9" width="5" height="5" rx="1.5" fill="var(--bl)" opacity=".6" />
              <rect x="9" y="9" width="5" height="5" rx="1.5" fill="var(--bl)" opacity=".3" />
            </svg>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.02em' }}>NextLevel Group</div>
          <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 4 }}>Log ind på dit dashboard</div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--s1)', border: '1px solid var(--bd)',
          borderRadius: 16, padding: '32px 28px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}>
          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="din@email.dk" required autoFocus
              />
            </div>
            <div>
              <label>Kodeord</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
              />
            </div>

            {error && <div className="alert-error">{error}</div>}

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '11px 0', fontSize: 14, marginTop: 4 }}>
              {loading ? 'Logger ind…' : 'Log ind'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: 'var(--t4)' }}>
          NextLevel Group · Sales Platform
        </div>
      </div>
    </div>
  );
}
