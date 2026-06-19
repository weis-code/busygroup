'use client';

import { useEffect, useState, FormEvent } from 'react';

interface User { id: string; email: string; name: string; role: string; created_at: string }

const ROLE_COLOR: Record<string, string> = { ADMIN: '#E74C3C', MANAGER: '#F39C12', SELLER: '#2ECC71' };

export default function SellersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('SELLER');

  async function load() {
    const data = await fetch('/api/admin/sellers').then(r => r.json());
    setUsers(data);
  }

  useEffect(() => { load(); }, []);

  function reset() { setEmail(''); setName(''); setPassword(''); setRole('SELLER'); setError(''); }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sellers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password, role }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Fejl'); return; }
      reset(); setOpen(false); load();
    } catch { setError('Netværksfejl'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 4 }}>Sælgere</h1>
          <p style={{ fontSize: 13, color: '#667788' }}>{users.length} brugere</p>
        </div>
        <button onClick={() => { reset(); setOpen(true); }} style={{ background: '#185FA5', color: '#fff', padding: '10px 18px', borderRadius: 8, fontWeight: 600, fontSize: 13 }}>+ Ny bruger</button>
      </div>

      <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['Navn', 'Email', 'Rolle', 'Oprettet'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '14px 18px', fontSize: 11, color: '#667788', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#667788', fontSize: 13 }}>Ingen brugere</td></tr>
            )}
            {users.map(u => (
              <tr key={u.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '13px 18px', fontSize: 13, fontWeight: 600, color: '#ECF0F1' }}>{u.name}</td>
                <td style={{ fontSize: 13, color: '#667788' }}>{u.email}</td>
                <td>
                  <span style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600,
                    background: `${ROLE_COLOR[u.role]}18`, color: ROLE_COLOR[u.role],
                  }}>{u.role}</span>
                </td>
                <td style={{ fontSize: 12, color: '#667788' }}>{new Date(u.created_at).toLocaleDateString('da-DK')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1A2A38', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 28, width: 420 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#ECF0F1', marginBottom: 22 }}>Opret ny bruger</div>
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label>Navn</label>
                <input value={name} onChange={e => setName(e.target.value)} required placeholder="Fulde navn" />
              </div>
              <div>
                <label>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="email@busygroup.dk" />
              </div>
              <div>
                <label>Kodeord</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Mindst 8 tegn" minLength={8} />
              </div>
              <div>
                <label>Rolle</label>
                <select value={role} onChange={e => setRole(e.target.value)}>
                  <option value="SELLER">SELLER</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              {error && <div style={{ color: '#E74C3C', fontSize: 12, padding: '8px 12px', background: 'rgba(231,76,60,0.1)', borderRadius: 6 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setOpen(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 7, background: 'rgba(255,255,255,0.06)', color: '#667788' }}>Annuller</button>
                <button type="submit" disabled={loading} style={{ flex: 2, padding: '10px 0', borderRadius: 7, background: '#185FA5', color: '#fff', fontWeight: 600 }}>
                  {loading ? 'Opretter…' : 'Opret bruger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
