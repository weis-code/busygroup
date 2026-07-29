'use client';

import { useEffect, useState, FormEvent } from 'react';

/* ── Shared types ─────────────────────────────────────── */
interface Company {
  id: number; name: string; slug: string; type: string;
  color: string; logo_initials: string; ownership_pct: number; stripe_enabled: boolean; created_at: string;
}
interface Period { id: string; name: string; start_date: string; end_date: string; created_at: string }
interface Target {
  id: string; seller_name: string; task_name: string; period_name: string;
  start_date: string; end_date: string; unit_goal: number | null; revenue_goal: number | null;
  user_id: string; task_id: string; period_id: string; display_mode: string;
  actual_count: number; actual_amount: number;
}
interface TargetUser { id: string; name: string; role: string }
interface TargetTask { id: string; name: string; client: string; display_mode: string }
interface Task {
  id: string; name: string; client: string; description: string | null;
  status: string; start_date: string | null; end_date: string | null;
  compensation_model: string; price_per_unit: number | null; percent_value: number | null;
  units_label: string; display_mode: string;
  seller_count: number; sales_count: number; log_count: number;
}
interface TaskPackage { id?: string; name: string; price: string }
interface TaskSeller   { task_id: string; user_id: string; user_name: string }
interface PortalEntry {
  id: number; customer_id: number; portal_token: string;
  last_login: string | null; created_at: string;
  customer_name: string; company_name: string; company_color: string;
}
interface PortalCustomer { id: number; name: string; company_name: string }

const TYPE_LABEL: Record<string, string> = {
  sales: 'Salg', consulting: 'Konsultering', saas: 'SaaS', group: 'Gruppe',
};

function isActivePeriod(p: Period) {
  const today = new Date().toISOString().slice(0, 10);
  return p.start_date <= today && today <= p.end_date;
}

/* ── Generelt tab ─────────────────────────────────────── */
function GeneraltTab() {
  const [deskCount, setDeskCount] = useState('');
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then(d => {
      setDeskCount(d.desk_count ?? '0');
      setLoading(false);
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setSaved(false);
    await fetch('/api/admin/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ desk_count: deskCount }),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) return <div style={{ padding: '20px 0', color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>;

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 520 }}>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: 28, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', marginBottom: 6 }}>Antal skriveborde</div>
        <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 16 }}>
          Bruges til at beregne omsætning pr. stol og potentiel omsætning ved fuldt belæg på admin oversigten.
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            type="number" min={0} max={999} value={deskCount}
            onChange={e => setDeskCount(e.target.value)} required
            style={{ width: 100, fontSize: 16, fontWeight: 700, textAlign: 'center' }}
          />
          <span style={{ fontSize: 13, color: 'var(--t3)' }}>skriveborde</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? 'Gemmer…' : 'Gem indstillinger'}
        </button>
        {saved && <span style={{ fontSize: 13, color: 'var(--gr)', fontWeight: 600 }}>Gemt</span>}
      </div>
    </form>
  );
}

/* ── Virksomheder tab ─────────────────────────────────── */
function VirksomhederTab() {
  const [companies, setCompanies] = useState<Company[]>([]);

  useEffect(() => {
    fetch('/api/companies').then(r => r.json()).then(setCompanies);
  }, []);

  return (
    <div>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 11, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '11px 15px', borderBottom: '1px solid var(--bd)', background: 'var(--s2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
            <span>Navn</span><span>Type</span><span>Ejerandel</span><span>Stripe</span><span>Oprettet</span>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {companies.map((company, i) => (
            <div key={company.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, padding: '13px 15px', borderTop: i > 0 ? '1px solid var(--bd)' : 'none', alignItems: 'center', transition: 'background 0.1s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${company.color}22`, border: `1.5px solid ${company.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: company.color, flexShrink: 0 }}>
                  {company.logo_initials}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>{company.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>{company.slug}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--t2)' }}>{TYPE_LABEL[company.type] ?? company.type}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{company.ownership_pct}%</div>
              <div>
                {company.stripe_enabled
                  ? <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--pu2)', color: 'var(--pu)', padding: '2px 8px', borderRadius: 100 }}>Aktiv</span>
                  : <span style={{ fontSize: 10, color: 'var(--t3)' }}>—</span>
                }
              </div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                {new Date(company.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          ))}
          {companies.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Ingen virksomheder endnu</div>
          )}
        </div>
      </div>
      <a href="/admin/crm/companies" style={{ fontSize: 12, color: 'var(--bl)', textDecoration: 'none' }}>
        → CRM&apos;s virksomheds-/kontaktliste (åbner i sin egen visning, bruges også som filter i pipeline)
      </a>
    </div>
  );
}

/* ── Lønperioder tab ──────────────────────────────────── */
function LoenperioderTab() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [name, setName]       = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');

  async function load() {
    const data = await fetch('/api/admin/periods').then(r => r.json());
    setPeriods(data);
  }

  useEffect(() => { load(); }, []);

  function reset() { setName(''); setStartDate(''); setEndDate(''); setError(''); }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (startDate >= endDate) { setError('Slutdato skal være efter startdato'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/periods', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, start_date: startDate, end_date: endDate }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Fejl'); return; }
      reset(); setOpen(false); load();
    } catch { setError('Netværksfejl'); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <div className="page-header">
        <p className="page-sub">{periods.length} perioder</p>
        <button onClick={() => { reset(); setOpen(true); }} className="btn btn-primary">+ Ny periode</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>{['Navn', 'Start', 'Slut', 'Status'].map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {periods.length === 0 && (
              <tr className="empty-row"><td colSpan={4}>Ingen perioder endnu</td></tr>
            )}
            {periods.map(p => {
              const active = isActivePeriod(p);
              return (
                <tr key={p.id}>
                  <td className="td-primary">{p.name}</td>
                  <td>{p.start_date}</td>
                  <td>{p.end_date}</td>
                  <td>
                    <span className={`badge ${active ? 'badge-green' : 'badge-muted'}`}>
                      {active ? 'Aktiv' : 'Afsluttet'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-title">Ny lønperiode</div>
            <form onSubmit={onSubmit} className="modal-form">
              <div className="form-group">
                <label>Navn</label>
                <input value={name} onChange={e => setName(e.target.value)} required placeholder="F.eks. Juni 2026" />
              </div>
              <div className="form-group">
                <label>Startdato</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Slutdato</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
              </div>
              {error && <div className="alert-error">{error}</div>}
              <div className="modal-footer">
                <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost" style={{ flex: 1 }}>Annuller</button>
                <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 2 }}>
                  {loading ? 'Opretter…' : 'Opret periode'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Targets tab ──────────────────────────────────────── */
const fmtKr = (n: number) => n.toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' kr';

function TargetProgressBar({ actual, goal, isAmount }: { actual: number; goal: number; isAmount: boolean }) {
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

function TargetsTab() {
  const [targets, setTargets]   = useState<Target[]>([]);
  const [users, setUsers]       = useState<TargetUser[]>([]);
  const [tasks, setTasks]       = useState<TargetTask[]>([]);
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
    setUsers(s.filter((u: TargetUser) => u.role === 'SELLER'));
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
    <div>
      <div className="page-header">
        <p className="page-sub">{targets.length} targets</p>
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
                        <TargetProgressBar actual={actual} goal={goal} isAmount={amt} />
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

/* ── Opgaver tab ──────────────────────────────────────── */
const MODEL_DK:   Record<string, string> = { FIXED: 'Fast pris', PERCENT: '% af ordre', PACKAGE: 'Pakker' };
const DISPLAY_DK: Record<string, string> = { COUNT: 'Antal salg', AMOUNT: 'Beløb lukket' };
const DISPLAY_CLR: Record<string, string> = { COUNT: 'var(--bl)', AMOUNT: 'var(--gr)' };
const DISPLAY_BG: Record<string, string>  = { COUNT: 'var(--bl2)', AMOUNT: 'var(--gr2)' };

const emptyTaskForm = () => ({
  name: '', client: '', description: '', status: 'active',
  start_date: '', end_date: '', compensation_model: 'FIXED',
  price_per_unit: '', percent_value: '', units_label: 'Antal', display_mode: 'COUNT',
  packages: [] as TaskPackage[], seller_ids: [] as string[],
});

function OpgaverTab() {
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [allSellers, setAllSellers] = useState<TargetUser[]>([]);
  const [taskSellers, setTaskSellers] = useState<TaskSeller[]>([]);
  const [modal, setModal]           = useState<'create' | 'edit' | null>(null);
  const [editId, setEditId]         = useState<string | null>(null);
  const [form, setForm]             = useState(emptyTaskForm());
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  async function load() {
    const [t, s] = await Promise.all([
      fetch('/api/admin/tasks').then(r => r.json()),
      fetch('/api/admin/sellers').then(r => r.json()),
    ]);
    setTasks(t.tasks || []);
    setTaskSellers(t.taskSellers || []);
    setAllSellers((s as TargetUser[]) || []);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm(emptyTaskForm()); setEditId(null); setError(''); setModal('create');
  }

  function openEdit(task: Task) {
    const sellers = taskSellers.filter(ts => ts.task_id === task.id).map(ts => ts.user_id);
    setForm({
      name: task.name, client: task.client, description: task.description || '',
      status: task.status, start_date: task.start_date || '', end_date: task.end_date || '',
      compensation_model: task.compensation_model,
      price_per_unit: task.price_per_unit?.toString() || '',
      percent_value: task.percent_value?.toString() || '',
      units_label: task.units_label || 'Antal',
      display_mode: task.display_mode || 'COUNT',
      packages: [], seller_ids: sellers,
    });
    setEditId(task.id); setError(''); setModal('edit');
  }

  function addPackage() {
    setForm(f => ({ ...f, packages: [...f.packages, { name: '', price: '' }] }));
  }
  function removePackage(i: number) {
    setForm(f => ({ ...f, packages: f.packages.filter((_, idx) => idx !== i) }));
  }
  function updatePackage(i: number, field: 'name' | 'price', val: string) {
    setForm(f => {
      const pkgs = [...f.packages];
      pkgs[i] = { ...pkgs[i], [field]: val };
      return { ...f, packages: pkgs };
    });
  }
  function toggleSeller(uid: string) {
    setForm(f => {
      const has = f.seller_ids.includes(uid);
      return { ...f, seller_ids: has ? f.seller_ids.filter(id => id !== uid) : [...f.seller_ids, uid] };
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const body = {
      ...form,
      price_per_unit: form.price_per_unit ? Number(form.price_per_unit) : null,
      percent_value: form.percent_value ? Number(form.percent_value) : null,
      packages: form.packages.filter(p => p.name && p.price).map(p => ({ name: p.name, price: Number(p.price) })),
    };
    try {
      const url    = modal === 'edit' ? `/api/admin/tasks/${editId}` : '/api/admin/tasks';
      const method = modal === 'edit' ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Fejl'); return; }
      setModal(null); load();
    } catch { setError('Netværksfejl'); }
    finally { setLoading(false); }
  }

  const hints: Record<string, Record<string, string>> = {
    COUNT:  { FIXED: 'Tracker antal salg. Sælger angiver antal units — omsætning = fast pris × antal.', PERCENT: 'Tracker antal salg mod mål. Sælger angiver ordrebeløbet — omsætning = % af det.', PACKAGE: 'Tracker antal salg. Sælger vælger en pakke ved hvert salg.' },
    AMOUNT: { FIXED: 'Tracker samlet omsætning. Sælger angiver antal units — omsætning = fast pris × antal.', PERCENT: 'Tracker beløb lukket. Sælger angiver ordrebeløbet — omsætning = % af det.', PACKAGE: 'Tracker beløb lukket. Sælger vælger en pakke ved hvert salg.' },
  };

  return (
    <div>
      <div className="page-header">
        <p className="page-sub">{tasks.length} opgaver</p>
        <button onClick={openCreate} className="btn btn-primary">+ Ny opgave</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>{['Navn', 'Klient', 'Model', 'Status', 'Sælgere', 'Salg', 'Logs', ''].map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {tasks.length === 0 && (
              <tr className="empty-row"><td colSpan={8}>Ingen opgaver endnu</td></tr>
            )}
            {tasks.map(t => (
              <tr key={t.id}>
                <td className="td-primary">{t.name}</td>
                <td style={{ color: 'var(--t3)' }}>{t.client}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, fontWeight: 700, background: DISPLAY_BG[t.display_mode], color: DISPLAY_CLR[t.display_mode] }}>
                      {DISPLAY_DK[t.display_mode] ?? t.display_mode}
                    </span>
                    <span className="badge badge-muted">{MODEL_DK[t.compensation_model]}</span>
                  </div>
                </td>
                <td>
                  <span className={`badge ${t.status === 'active' ? 'badge-green' : 'badge-muted'}`}>
                    {t.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </td>
                <td style={{ color: 'var(--t3)' }}>{t.seller_count}</td>
                <td style={{ color: 'var(--t3)' }}>{t.sales_count}</td>
                <td style={{ color: 'var(--t3)' }}>{t.log_count}</td>
                <td>
                  <button onClick={() => openEdit(t)} className="btn btn-ghost btn-sm">Rediger</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ width: 540, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-title">
              {modal === 'create' ? 'Opret opgave' : 'Rediger opgave'}
            </div>
            <form onSubmit={onSubmit} className="modal-form">
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Navn</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Opgavenavn" />
                </div>
                <div className="form-group">
                  <label>Klient</label>
                  <input value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} required placeholder="Klientnavn" />
                </div>
              </div>
              <div className="form-group">
                <label>Beskrivelse (valgfri)</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
              </div>
              <div className="form-grid-3">
                <div className="form-group">
                  <label>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="active">Aktiv</option>
                    <option value="inactive">Inaktiv</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Startdato</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Slutdato</label>
                  <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Mål tracker</label>
                  <select value={form.display_mode} onChange={e => setForm(f => ({ ...f, display_mode: e.target.value }))}>
                    <option value="COUNT">Antal salg</option>
                    <option value="AMOUNT">Beløb lukket (kr)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Omsætning beregnes som</label>
                  <select value={form.compensation_model} onChange={e => setForm(f => ({ ...f, compensation_model: e.target.value, packages: [] }))}>
                    <option value="FIXED">Fast pris pr. salg</option>
                    <option value="PERCENT">Procent af ordrebeløb</option>
                    <option value="PACKAGE">Pakkepriser</option>
                  </select>
                </div>
              </div>

              {hints[form.display_mode]?.[form.compensation_model] && (
                <div className="alert-info">{hints[form.display_mode][form.compensation_model]}</div>
              )}

              {form.compensation_model === 'FIXED' && (
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Pris pr. unit (kr)</label>
                    <input type="number" min="0" value={form.price_per_unit} onChange={e => setForm(f => ({ ...f, price_per_unit: e.target.value }))} required placeholder="0" />
                  </div>
                  <div className="form-group">
                    <label>Sælgerlabel</label>
                    <input value={form.units_label} onChange={e => setForm(f => ({ ...f, units_label: e.target.value }))} placeholder="Antal møder" />
                  </div>
                </div>
              )}
              {form.compensation_model === 'PERCENT' && (
                <div className="form-group">
                  <label>Procent af deal (%)</label>
                  <input type="number" min="0" max="100" step="0.01" value={form.percent_value} onChange={e => setForm(f => ({ ...f, percent_value: e.target.value }))} required placeholder="0.00" />
                </div>
              )}
              {form.compensation_model === 'PACKAGE' && (
                <div className="form-group">
                  <label>Pakker</label>
                  {form.packages.map((pkg, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input value={pkg.name} onChange={e => updatePackage(i, 'name', e.target.value)} placeholder="Pakkenavn" style={{ flex: 2 }} />
                      <input type="number" value={pkg.price} onChange={e => updatePackage(i, 'price', e.target.value)} placeholder="Pris" style={{ flex: 1 }} />
                      <button type="button" onClick={() => removePackage(i)} className="btn btn-danger btn-sm">×</button>
                    </div>
                  ))}
                  <button type="button" onClick={addPackage} className="btn btn-ghost btn-sm">+ Tilføj pakke</button>
                </div>
              )}

              <div className="form-group">
                <label>Tilknyttede sælgere</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  {allSellers.filter(u => u.role === 'SELLER').map(s => {
                    const selected = form.seller_ids.includes(s.id);
                    return (
                      <button key={s.id} type="button" onClick={() => toggleSeller(s.id)} style={{
                        padding: '5px 12px', borderRadius: 6, fontSize: 12,
                        background: selected ? 'var(--bl2)' : 'var(--bd)',
                        border: `1px solid ${selected ? 'var(--bl)' : 'var(--bd2)'}`,
                        color: selected ? 'var(--bl)' : 'var(--t3)',
                        cursor: 'pointer',
                      }}>{s.name}</button>
                    );
                  })}
                </div>
              </div>

              {error && <div className="alert-error">{error}</div>}

              <div className="modal-footer">
                <button type="button" onClick={() => setModal(null)} className="btn btn-ghost" style={{ flex: 1 }}>Annuller</button>
                <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 2 }}>
                  {loading ? 'Gemmer…' : modal === 'create' ? 'Opret opgave' : 'Gem ændringer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Klientportal tab ─────────────────────────────────── */
function SettingsToast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, [onDone]);
  return <div className="toast-container"><div className="toast">{msg}</div></div>;
}

function copyText(text: string, onCopied: (msg: string) => void) {
  navigator.clipboard.writeText(text).then(() => onCopied('Link kopieret ✓'));
}

function PortalTab() {
  const [entries, setEntries] = useState<PortalEntry[]>([]);
  const [customers, setCustomers] = useState<PortalCustomer[]>([]);
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    const res = await fetch('/api/admin/portal-access').then(r => r.json()).catch(() => []) as PortalEntry[];
    setEntries(res);
    const cus = await fetch('/api/customers').then(r => r.json()) as PortalCustomer[];
    setCustomers(cus);
  }

  useEffect(() => { load(); }, []);

  async function createAccess() {
    if (!selectedCustomer) return;
    setCreating(true);
    await fetch('/api/admin/portal-access', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: Number(selectedCustomer) }),
    });
    setModal(false);
    setSelectedCustomer('');
    setCreating(false);
    setToast('Portaladgang oprettet');
    load();
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div>
      {toast && <SettingsToast msg={toast} onDone={() => setToast('')} />}

      <div className="page-header">
        <p className="page-sub">Adgangslinks til kunder</p>
        <button onClick={() => setModal(true)} className="btn btn-primary">+ Ny adgang</button>
      </div>

      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 11, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--s2)' }}>
                {['Kunde', 'Virksomhed', 'Portal URL', 'Sidst set', 'Oprettet'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Ingen portaladgange endnu</td></tr>
              )}
              {entries.map(e => (
                <tr key={e.id} style={{ borderTop: '1px solid var(--bd)' }}
                  onMouseEnter={el => { (el.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={el => { (el.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{e.customer_name}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: e.company_color }} />
                      <span style={{ fontSize: 12, color: 'var(--t2)' }}>{e.company_name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <code style={{ fontSize: 10, color: 'var(--t3)', background: 'var(--s2)', padding: '2px 6px', borderRadius: 4 }}>
                        /portal/{e.portal_token.slice(0, 12)}…
                      </code>
                      <button onClick={() => copyText(`${baseUrl}/portal/${e.portal_token}`, setToast)}
                        style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 5, padding: '3px 8px', fontSize: 10, color: 'var(--t2)', minHeight: 44, minWidth: 44 }}>
                        Kopiér
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--t2)' }}>
                    {e.last_login ? new Date(e.last_login).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--t3)' }}>
                    {new Date(e.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="modal-box" style={{ background: 'var(--s1)', borderRadius: 13, padding: 24, width: 400, maxWidth: '94vw', boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 20 }}>Ny portaladgang</div>
            <div style={{ marginBottom: 16 }}>
              <label>Kunde</label>
              <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}>
                <option value="">Vælg kunde</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company_name})</option>)}
              </select>
            </div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 16, lineHeight: 1.5 }}>
              Der genereres et unikt link som kunden kan bruge til at tilgå deres portal.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12 }}>Annuller</button>
              <button onClick={createAccess} disabled={!selectedCustomer || creating}
                style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600 }}>
                {creating ? 'Opretter…' : 'Opret link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main page ────────────────────────────────────────── */
type Tab = 'generelt' | 'virksomheder' | 'perioder' | 'targets' | 'opgaver' | 'portal';
const TABS: { id: Tab; label: string }[] = [
  { id: 'generelt',     label: 'Generelt' },
  { id: 'virksomheder', label: 'Virksomheder' },
  { id: 'perioder',     label: 'Lønperioder' },
  { id: 'targets',      label: 'Targets' },
  { id: 'opgaver',      label: 'Opgaver' },
  { id: 'portal',       label: 'Klientportal' },
];

export default function AdminSettingsPage() {
  const [tab, setTab] = useState<Tab>('generelt');

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">Indstillinger</h1>
        <p className="page-sub">Konfiguration der ikke ændrer sig fra dag til dag.</p>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--bd)', marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 14px', fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
            color: tab === t.id ? 'var(--bl)' : 'var(--t2)',
            borderBottom: `2px solid ${tab === t.id ? 'var(--bl)' : 'transparent'}`,
            marginBottom: -1, transition: 'all 0.12s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'generelt' && <GeneraltTab />}
      {tab === 'virksomheder' && <VirksomhederTab />}
      {tab === 'perioder' && <LoenperioderTab />}
      {tab === 'targets' && <TargetsTab />}
      {tab === 'opgaver' && <OpgaverTab />}
      {tab === 'portal' && <PortalTab />}
    </div>
  );
}
