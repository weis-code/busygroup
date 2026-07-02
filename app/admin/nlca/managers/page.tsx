'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const CYAN = '#06b6d4';

const USD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

interface Manager {
  id: number;
  user_id: string;
  name: string;
  email: string | null;
  created_at: string;
  creator_count: number;
  payout_this_month: number;
}

export default function NlcaManagersPage() {
  const router = useRouter();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/nlca/managers');
      if (res.status === 403) { router.push('/admin/nlca'); return; }
      if (!res.ok) return;
      const data = await res.json() as Manager[];
      setManagers(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function createManager() {
    if (!form.name || !form.email || !form.password) {
      setError('Alle felter kræves');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/nlca/managers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setError(d.error ?? 'Noget gik galt');
        return;
      }
      const created = await res.json() as Manager;
      setManagers(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setForm({ name: '', email: '', password: '' });
      setShowCreate(false);
      void load();
    } catch {
      setError('Netværksfejl — prøv igen');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', margin: 0, marginBottom: 4 }}>Managers</h1>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>NLCA · {managers.length} managers</div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{ background: CYAN, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          + Opret manager
        </button>
      </div>

      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden' }}>
        {managers.length === 0 ? (
          <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
            Ingen managers endnu. <button onClick={() => setShowCreate(true)} style={{ color: CYAN, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Opret den første →</button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--s2)' }}>
                <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Navn</th>
                <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</th>
                <th style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Creators</th>
                <th style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Udbetaling (mdr.)</th>
                <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Oprettet</th>
              </tr>
            </thead>
            <tbody>
              {managers.map((m, i) => (
                <tr key={m.id} style={{ borderTop: i > 0 ? '1px solid var(--bd)' : 'none' }}>
                  <td style={{ padding: '11px 14px', color: 'var(--t1)', fontWeight: 500 }}>{m.name}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--t3)', fontSize: 12 }}>{m.email ?? '—'}</td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', color: 'var(--t1)' }}>{m.creator_count}</td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 600, color: CYAN }}>{USD(Number(m.payout_this_month ?? 0))}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--t3)', fontSize: 12 }}>
                    {new Date(m.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <div style={{ background: 'var(--s1)', borderRadius: 13, padding: 28, width: 400, maxWidth: '94vw' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 6 }}>Opret manager</div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 20 }}>Opretter en brugerkonto med rollen NLCA_MANAGER</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Navn *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Fuldt navn" autoFocus style={{ width: '100%', marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@eksempel.dk" style={{ width: '100%', marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Kodeord *</label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Midlertidigt kodeord" style={{ width: '100%', marginTop: 4 }} />
              </div>
              {error && <div style={{ fontSize: 12, color: 'var(--re)', background: 'var(--re2)', padding: '8px 12px', borderRadius: 6 }}>{error}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowCreate(false); setError(''); }} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12 }}>Annuller</button>
              <button onClick={() => void createManager()} disabled={!form.name || !form.email || !form.password || saving} style={{ background: CYAN, color: '#fff', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Opretter…' : 'Opret manager'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
