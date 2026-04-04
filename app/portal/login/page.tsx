'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function PortalLoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/portal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        router.replace('/portal');
      } else {
        setError(data.error || 'Login fejlede');
      }
    } catch {
      setError('Netværksfejl — prøv igen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#0C0F14', padding: '24px',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 400, background: 'rgba(232,64,37,0.06)',
        borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%', maxWidth: 400, position: 'relative', zIndex: 1,
      }}>
        {/* Logo / brand */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #E84025 0%, #C0331A 100%)',
            marginBottom: 16, boxShadow: '0 8px 24px rgba(232,64,37,0.35)',
          }}>
            <span style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>B</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#ECF0F1' }}>
            Kundeportal
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#556677' }}>
            Log ind for at se dit overblik
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#111820', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, padding: '28px 28px 24px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Email */}
            <div>
              <label style={{ fontSize: 11, color: '#667788', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Email
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#3A4A5A', pointerEvents: 'none' }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="din@email.dk"
                  required
                  autoComplete="email"
                  style={{
                    width: '100%', padding: '10px 12px 10px 36px',
                    background: '#0C0F14', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, color: '#ECF0F1', fontSize: 14, outline: 'none',
                    boxSizing: 'border-box', transition: 'border-color 0.15s',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(232,64,37,0.5)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ fontSize: 11, color: '#667788', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                Adgangskode
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#3A4A5A', pointerEvents: 'none' }} />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  style={{
                    width: '100%', padding: '10px 40px 10px 36px',
                    background: '#0C0F14', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, color: '#ECF0F1', fontSize: 14, outline: 'none',
                    boxSizing: 'border-box', transition: 'border-color 0.15s',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(232,64,37,0.5)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#3A4A5A', padding: 2 }}
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: 'rgba(232,64,37,0.1)', border: '1px solid rgba(232,64,37,0.25)', borderRadius: 7, padding: '9px 12px', fontSize: 13, color: '#E84025' }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              style={{
                width: '100%', padding: '11px', borderRadius: 9,
                background: !loading && email && password ? '#E84025' : 'rgba(255,255,255,0.06)',
                border: 'none', color: !loading && email && password ? '#fff' : '#3A4A5A',
                fontSize: 14, fontWeight: 600, cursor: !loading && email && password ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.15s', marginTop: 4,
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} />
                  Logger ind...
                </>
              ) : 'Log ind'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#2D3748' }}>
          Problemer med login? Kontakt din kontaktperson.
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
