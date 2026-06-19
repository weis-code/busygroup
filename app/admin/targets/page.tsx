'use client';

import { useEffect, useState, FormEvent } from 'react';

interface Target {
  id: string; seller_name: string; task_name: string; period_name: string;
  start_date: string; end_date: string; unit_goal: number | null; revenue_goal: number | null;
  user_id: string; task_id: string; period_id: string;
}
interface User { id: string; name: string; role: string }
interface Task { id: string; name: string; client: string }
interface Period { id: string; name: string; start_date: string; end_date: string }

export default function TargetsPage() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ period_id: '', user_id: '', task_id: '', unit_goal: '', revenue_goal: '' });

  async function load() {
    const [tg, s, t, p] = await Promise.all([
      fetch('/api/admin/targets').then(r => r.json()),
      fetch('/api/admin/sellers').then(r => r.json()),
      fetch('/api/admin/tasks').then(r => r.json()),
      fetch('/api/admin/periods').then(r => r.json()),
    ]);
    setTargets(tg);
    setUsers(s.filter((u: User) => u.role === 'SELLER'));
    setTasks(t.tasks || []);
    setPeriods(p);
  }

  useEffect(() => { load(); }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/targets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_id: form.period_id, user_id: form.user_id, task_id: form.task_id,
          unit_goal: form.unit_goal ? Number(form.unit_goal) : null,
          revenue_goal: form.revenue_goal ? Number(form.revenue_goal) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Fejl'); return; }
      setOpen(false);
      setForm({ period_id: '', user_id: '', task_id: '', unit_goal: '', revenue_goal: '' });
      load();
    } catch { setError('Netværksfejl'); }
    finally { setLoading(false); }
  }

  async function deleteTarget(id: string) {
    if (!confirm('Slet dette target?')) return;
    await fetch(`/api/admin/targets/${id}`, { method: 'DELETE' });
    load();
  }

  // Group by period
  const byPeriod = targets.reduce((acc, t) => {
    const key = t.period_name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, Target[]>);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 4 }}>Targets</h1>
          <p style={{ fontSize: 13, color: '#667788' }}>{targets.length} targets</p>
        </div>
        <button onClick={() => { setError(''); setOpen(true); }} style={{ background: '#185FA5', color: '#fff', padding: '10px 18px', borderRadius: 8, fontWeight: 600, fontSize: 13 }}>+ Nyt target</button>
      </div>

      {Object.entries(byPeriod).map(([period, rows]) => (
        <div key={period} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: '#667788', letterSpacing: '0.05em', marginBottom: 10 }}>{period.toUpperCase()}</div>
          <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  {['Sælger', 'Opgave', 'Unit-mål', 'Omsætningsmål', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, color: '#667788', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(t => (
                  <tr key={t.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 600, color: '#ECF0F1' }}>{t.seller_name}</td>
                    <td style={{ fontSize: 13, color: '#667788' }}>{t.task_name}</td>
                    <td style={{ fontSize: 13, color: '#ECF0F1', fontVariantNumeric: 'tabular-nums' }}>{t.unit_goal ?? '—'}</td>
                    <td style={{ fontSize: 13, color: '#ECF0F1', fontVariantNumeric: 'tabular-nums' }}>
                      {t.revenue_goal ? Number(t.revenue_goal).toLocaleString('da-DK') + ' kr' : '—'}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <button onClick={() => deleteTarget(t.id)} style={{ background: 'rgba(231,76,60,0.1)', color: '#E74C3C', padding: '4px 10px', borderRadius: 5, fontSize: 12 }}>Slet</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {targets.length === 0 && (
        <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '40px', textAlign: 'center', color: '#667788', fontSize: 13 }}>
          Ingen targets sat endnu
        </div>
      )}

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1A2A38', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 28, width: 440 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#ECF0F1', marginBottom: 22 }}>Nyt target</div>
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label>Lønperiode</label>
                <select value={form.period_id} onChange={e => setForm(f => ({ ...f, period_id: e.target.value }))} required>
                  <option value="">Vælg periode…</option>
                  {periods.map(p => <option key={p.id} value={p.id}>{p.name} ({p.start_date} → {p.end_date})</option>)}
                </select>
              </div>
              <div>
                <label>Sælger</label>
                <select value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} required>
                  <option value="">Vælg sælger…</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label>Opgave</label>
                <select value={form.task_id} onChange={e => setForm(f => ({ ...f, task_id: e.target.value }))} required>
                  <option value="">Vælg opgave…</option>
                  {tasks.map(t => <option key={t.id} value={t.id}>{t.name} — {t.client}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label>Unit-mål (valgfri)</label>
                  <input type="number" min="0" value={form.unit_goal} onChange={e => setForm(f => ({ ...f, unit_goal: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <label>Omsætningsmål kr (valgfri)</label>
                  <input type="number" min="0" value={form.revenue_goal} onChange={e => setForm(f => ({ ...f, revenue_goal: e.target.value }))} placeholder="0" />
                </div>
              </div>
              {error && <div style={{ color: '#E74C3C', fontSize: 12, padding: '8px 12px', background: 'rgba(231,76,60,0.1)', borderRadius: 6 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setOpen(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 7, background: 'rgba(255,255,255,0.06)', color: '#667788' }}>Annuller</button>
                <button type="submit" disabled={loading} style={{ flex: 2, padding: '10px 0', borderRadius: 7, background: '#185FA5', color: '#fff', fontWeight: 600 }}>
                  {loading ? 'Gemmer…' : 'Gem target'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
