'use client';

import { useEffect, useState, FormEvent } from 'react';

interface Target {
  id: string; seller_name: string; task_name: string; period_name: string;
  start_date: string; end_date: string; unit_goal: number | null; revenue_goal: number | null;
  user_id: string; task_id: string; period_id: string; display_mode: string;
  actual_count: number; actual_amount: number;
}
interface User   { id: string; name: string; role: string }
interface Task   { id: string; name: string; client: string; display_mode: string }
interface Period { id: string; name: string; start_date: string; end_date: string }

const fmtKr = (n: number) => n.toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' kr';

function ProgressBar({ actual, goal, isAmount }: { actual: number; goal: number; isAmount: boolean }) {
  const pct  = goal > 0 ? Math.min(100, Math.round(actual / goal * 100)) : 0;
  const done = pct >= 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 80, height: 6, background: 'var(--bd)', borderRadius: 3 }}>
        <div style={{ height: '100%', borderRadius: 3, width: goal > 0 ? `${pct}%` : '0%', background: done ? 'var(--gr)' : 'var(--bl)', transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 12, color: done ? 'var(--gr)' : 'var(--t1)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {isAmount ? fmtKr(actual) : actual}
        {goal > 0 && <span style={{ color: 'var(--t3)' }}> / {isAmount ? fmtKr(goal) : goal}</span>}
        {goal > 0 && <span style={{ color: done ? 'var(--gr)' : 'var(--t3)' }}> ({pct}%)</span>}
      </span>
    </div>
  );
}

export default function TargetsPage() {
  const [targets, setTargets]   = useState<Target[]>([]);
  const [users, setUsers]       = useState<User[]>([]);
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [periods, setPeriods]   = useState<Period[]>([]);
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [form, setForm]         = useState({ period_id: '', user_id: '', task_id: '', unit_goal: '', revenue_goal: '' });

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
      <div className="page-header">
        <div>
          <h1 className="page-title">Targets</h1>
          <p className="page-sub">{targets.length} targets</p>
        </div>
        <button onClick={() => { setError(''); setOpen(true); }} className="btn btn-primary">+ Nyt target</button>
      </div>

      {Object.entries(byPeriod).map(([period, rows]) => (
        <div key={period} style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: 'var(--t3)', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase' }}>{period}</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>{['Sælger', 'Opgave', 'Måler på', 'Mål', 'Opnået', ''].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map(t => {
                  const amt    = t.display_mode === 'AMOUNT';
                  const goal   = amt ? Number(t.revenue_goal ?? 0) : Number(t.unit_goal ?? 0);
                  const actual = amt ? Number(t.actual_amount) : t.actual_count;
                  return (
                    <tr key={t.id}>
                      <td className="td-primary">{t.seller_name}</td>
                      <td style={{ color: 'var(--t3)' }}>{t.task_name}</td>
                      <td>
                        <span className={`badge ${amt ? 'badge-green' : 'badge-blue'}`}>
                          {amt ? 'Beløb' : 'Antal salg'}
                        </span>
                      </td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {goal > 0 ? (amt ? fmtKr(goal) : goal) : '—'}
                      </td>
                      <td>
                        <ProgressBar actual={actual} goal={goal} isAmount={amt} />
                      </td>
                      <td>
                        <button onClick={() => deleteTarget(t.id)} className="btn btn-sm btn-danger">Slet</button>
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
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '40px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
          Ingen targets sat endnu
        </div>
      )}

      {open && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-title">Nyt target</div>
            <form onSubmit={onSubmit} className="modal-form">
              <div className="form-group">
                <label>Lønperiode</label>
                <select value={form.period_id} onChange={e => setForm(f => ({ ...f, period_id: e.target.value }))} required>
                  <option value="">Vælg periode…</option>
                  {periods.map(p => <option key={p.id} value={p.id}>{p.name} ({p.start_date} → {p.end_date})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Sælger</label>
                <select value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} required>
                  <option value="">Vælg sælger…</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="form-group">
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
                <div className="alert-info">
                  Denne opgave måler på: <strong style={{ color: isAmount ? 'var(--gr)' : 'var(--bl)' }}>{isAmount ? 'beløb lukket (kr)' : 'antal salg'}</strong>
                </div>
              )}

              {form.task_id && !isAmount && (
                <div className="form-group">
                  <label>Antal salg mål</label>
                  <input type="number" min="0" value={form.unit_goal} onChange={e => setForm(f => ({ ...f, unit_goal: e.target.value }))} placeholder="f.eks. 20" />
                </div>
              )}
              {form.task_id && isAmount && (
                <div className="form-group">
                  <label>Beløbsmål (kr)</label>
                  <input type="number" min="0" value={form.revenue_goal} onChange={e => setForm(f => ({ ...f, revenue_goal: e.target.value }))} placeholder="f.eks. 500000" />
                </div>
              )}

              {error && <div className="alert-error">{error}</div>}
              <div className="modal-footer">
                <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost" style={{ flex: 1 }}>Annuller</button>
                <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 2 }}>
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
