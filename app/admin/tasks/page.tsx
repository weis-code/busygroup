'use client';

import { useEffect, useState, FormEvent } from 'react';

interface Task {
  id: string; name: string; client: string; description: string | null;
  status: string; start_date: string | null; end_date: string | null;
  compensation_model: string; price_per_unit: number | null; percent_value: number | null;
  units_label: string; display_mode: string;
  seller_count: number; sales_count: number; log_count: number;
}
interface Package    { id?: string; name: string; price: string }
interface Seller     { id: string; name: string; email: string; role: string }
interface TaskSeller { task_id: string; user_id: string; user_name: string }

const MODEL_DK:   Record<string, string> = { FIXED: 'Fast pris', PERCENT: '% af ordre', PACKAGE: 'Pakker' };
const DISPLAY_DK: Record<string, string> = { COUNT: 'Antal salg', AMOUNT: 'Beløb lukket' };
const DISPLAY_CLR: Record<string, string> = { COUNT: 'var(--bl)', AMOUNT: 'var(--gr)' };
const DISPLAY_BG: Record<string, string>  = { COUNT: 'var(--bl2)', AMOUNT: 'var(--gr2)' };

const emptyForm = () => ({
  name: '', client: '', description: '', status: 'active',
  start_date: '', end_date: '', compensation_model: 'FIXED',
  price_per_unit: '', percent_value: '', units_label: 'Antal', display_mode: 'COUNT',
  packages: [] as Package[], seller_ids: [] as string[],
});

export default function TasksPage() {
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [allSellers, setAllSellers] = useState<Seller[]>([]);
  const [taskSellers, setTaskSellers] = useState<TaskSeller[]>([]);
  const [modal, setModal]           = useState<'create' | 'edit' | null>(null);
  const [editId, setEditId]         = useState<string | null>(null);
  const [form, setForm]             = useState(emptyForm());
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  async function load() {
    const [t, s] = await Promise.all([
      fetch('/api/admin/tasks').then(r => r.json()),
      fetch('/api/admin/sellers').then(r => r.json()),
    ]);
    setTasks(t.tasks || []);
    setTaskSellers(t.taskSellers || []);
    setAllSellers((s as Seller[]) || []);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm(emptyForm()); setEditId(null); setError(''); setModal('create');
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
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Opgaver</h1>
          <p className="page-sub">{tasks.length} opgaver</p>
        </div>
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
