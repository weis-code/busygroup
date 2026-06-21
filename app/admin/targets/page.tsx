'use client';

import { useEffect, useState, FormEvent } from 'react';

interface Target {
  id: string; seller_name: string; task_name: string; period_name: string;
  start_date: string; end_date: string; unit_goal: number | null; revenue_goal: number | null;
  user_id: string; task_id: string; period_id: string; display_mode: string;
  actual_count: number; actual_amount: number;
}
interface User { id: string; name: string; role: string }
interface Task { id: string; name: string; client: string; display_mode: string }
interface Period { id: string; name: string; start_date: string; end_date: string }

const fmtKr = (n: number) => n.toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' kr';

function ProgressBar({ actual, goal, isAmount }: { actual: number; goal: number; isAmount: boolean }) {
  const pct = goal > 0 ? Math.min(100, Math.round(actual / goal * 100)) : 0;
  const done = pct >= 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 80, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
        <div style={{ height: '100%', borderRadius: 3, width: goal > 0 ? `${pct}%` : '0%', background: done ? '#2ECC71' : '#185FA5', transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 12, color: done ? '#2ECC71' : '#ECF0F1', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {isAmount ? fmtKr(actual) : actual}
        {goal > 0 && <span style={{ color: '#667788' }}> / {isAmount ? fmtKr(goal) : goal}</span>}
        {goal > 0 && <span style={{ color: done ? '#2ECC71' : '#667788' }}> ({pct}%)</span>}
      </span>
    </div>
  );
}

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

  const selectedTask = tasks.find(t => t.id === form.task_id);
  const isAmount = selectedTask?.display_mode === 'AMOUNT';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/targets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_id: form.period_id, user_id: form.user_id, task_id: form.task_id,
          unit_goal: !isAmount && form.unit_goal ? Number(form.unit_goal) : null,
          revenue_goal: isAmount && form.revenue_goal ? Number(form.revenue_goal) : null,
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

  const byPeriod = targets.reduce((acc, t) => {
    const key = t.period_name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, Target[]>);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 4 }}>Targets</h1>
          <p style={{ fontSize: 13, color: '#667788' }}>{targets.length} targets</p>
        </div>
        <button onClick={() => { setError(''); setOpen(true); }} style={{ background: '#185FA5', color: '#fff', padding: '10px 18px', borderRadius: 8, fontWeight: 600, fontSize: 13 }}>+ Nyt target</button>
      </div>

      {Object.entries(byPeriod).map(([period, rows]) => (
        <div key={period} style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, color: '#667788', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 10 }}>{period.toUpperCase()}</div>
          <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  {['Sælger', 'Opgave', 'Måler på', 'Mål', 'Opnået', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, color: '#667788', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(t => {
                  const amt = t.display_mode === 'AMOUNT';
                  const goal = amt ? Number(t.revenue_goal ?? 0) : Number(t.unit_goal ?? 0);
                  const actual = amt ? Number(t.actual_amount) : t.actual_count;
                  return (
                    <tr key={t.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#ECF0F1' }}>{t.seller_name}</td>
                      <td style={{ fontSize: 13, color: '#667788' }}>{t.task_name}</td>
                      <td>
                        <span style={{
                          fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600,
                          background: amt ? 'rgba(15,110,86,0.2)' : 'rgba(24,95,165,0.2)',
                          color: amt ? '#2ECC71' : '#185FA5',
                        }}>
                          {amt ? 'Beløb' : 'Antal salg'}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: '#ECF0F1', fontVariantNumeric: 'tabular-nums' }}>
                        {goal > 0 ? (amt ? fmtKr(goal) : goal) : '—'}
                      </td>
                      <td>
                        <ProgressBar actual={actual} goal={goal} isAmount={amt} />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button onClick={() => deleteTarget(t.id)} style={{ background: 'rgba(231,76,60,0.1)', color: '#E74C3C', padding: '4px 10px', borderRadius: 5, fontSize: 12 }}>Slet</button>
                      </td>
                    </tr>
                  );
                })}
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
                <select value={form.task_id} onChange={e => setForm(f => ({ ...f, task_id: e.target.value, unit_goal: '', revenue_goal: '' }))} required>
                  <option value="">Vælg opgave…</option>
                  {tasks.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {t.client} ({t.display_mode === 'AMOUNT' ? 'Beløb' : 'Antal salg'})
                    </option>
                  ))}
                </select>
              </div>

              {form.task_id && (
                <div style={{ background: 'rgba(24,95,165,0.1)', border: '1px solid rgba(24,95,165,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#667788' }}>
                  Denne opgave måler på: <strong style={{ color: isAmount ? '#2ECC71' : '#185FA5' }}>{isAmount ? 'beløb lukket (kr)' : 'antal salg'}</strong>
                </div>
              )}

              {form.task_id && !isAmount && (
                <div>
                  <label>Antal salg mål</label>
                  <input type="number" min="0" value={form.unit_goal} onChange={e => setForm(f => ({ ...f, unit_goal: e.target.value }))} placeholder="f.eks. 20" />
                </div>
              )}
              {form.task_id && isAmount && (
                <div>
                  <label>Beløbsmål (kr)</label>
                  <input type="number" min="0" value={form.revenue_goal} onChange={e => setForm(f => ({ ...f, revenue_goal: e.target.value }))} placeholder="f.eks. 500000" />
                </div>
              )}

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
