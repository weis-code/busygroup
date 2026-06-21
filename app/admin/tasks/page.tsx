'use client';

import { useEffect, useState, FormEvent } from 'react';

interface Task {
  id: string; name: string; client: string; description: string | null;
  status: string; start_date: string | null; end_date: string | null;
  compensation_model: string; price_per_unit: number | null; percent_value: number | null;
  units_label: string; display_mode: string;
  seller_count: number; sales_count: number; log_count: number;
}
interface Package { id?: string; name: string; price: string }
interface Seller { id: string; name: string; email: string; role: string }
interface TaskSeller { task_id: string; user_id: string; user_name: string }

const MODEL_DK: Record<string, string> = { FIXED: 'Fast (per unit)', PERCENT: 'Procent af deal', PACKAGE: 'Pakker' };

const emptyForm = () => ({
  name: '', client: '', description: '', status: 'active',
  start_date: '', end_date: '', compensation_model: 'FIXED',
  price_per_unit: '', percent_value: '', units_label: 'Antal', display_mode: 'COUNT',
  packages: [] as Package[], seller_ids: [] as string[],
});

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allSellers, setAllSellers] = useState<Seller[]>([]);
  const [taskSellers, setTaskSellers] = useState<TaskSeller[]>([]);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      const url = modal === 'edit' ? `/api/admin/tasks/${editId}` : '/api/admin/tasks';
      const method = modal === 'edit' ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Fejl'); return; }
      setModal(null); load();
    } catch { setError('Netværksfejl'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 4 }}>Opgaver</h1>
          <p style={{ fontSize: 13, color: '#667788' }}>{tasks.length} opgaver</p>
        </div>
        <button onClick={openCreate} style={{ background: '#185FA5', color: '#fff', padding: '10px 18px', borderRadius: 8, fontWeight: 600, fontSize: 13 }}>+ Ny opgave</button>
      </div>

      <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['Navn', 'Klient', 'Model', 'Status', 'Sælgere', 'Salg', 'Logs', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '14px 16px', fontSize: 11, color: '#667788', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 && (
              <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#667788', fontSize: 13 }}>Ingen opgaver endnu</td></tr>
            )}
            {tasks.map(t => (
              <tr key={t.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#ECF0F1' }}>{t.name}</td>
                <td style={{ fontSize: 13, color: '#667788' }}>{t.client}</td>
                <td style={{ fontSize: 12, color: '#667788' }}>{MODEL_DK[t.compensation_model]}</td>
                <td>
                  <span style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600,
                    background: t.status === 'active' ? 'rgba(46,204,113,0.12)' : 'rgba(255,255,255,0.06)',
                    color: t.status === 'active' ? '#2ECC71' : '#667788',
                  }}>{t.status === 'active' ? 'Aktiv' : 'Inaktiv'}</span>
                </td>
                <td style={{ fontSize: 13, color: '#667788' }}>{t.seller_count}</td>
                <td style={{ fontSize: 13, color: '#667788' }}>{t.sales_count}</td>
                <td style={{ fontSize: 13, color: '#667788' }}>{t.log_count}</td>
                <td style={{ padding: '12px 16px' }}>
                  <button onClick={() => openEdit(t)} style={{ background: 'rgba(255,255,255,0.06)', color: '#667788', padding: '5px 12px', borderRadius: 6, fontSize: 12 }}>Rediger</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1A2A38', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 28, width: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#ECF0F1', marginBottom: 22 }}>
              {modal === 'create' ? 'Opret opgave' : 'Rediger opgave'}
            </div>
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label>Navn</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Opgavenavn" />
                </div>
                <div>
                  <label>Klient</label>
                  <input value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} required placeholder="Klientnavn" />
                </div>
              </div>
              <div>
                <label>Beskrivelse (valgfri)</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="active">Aktiv</option>
                    <option value="inactive">Inaktiv</option>
                  </select>
                </div>
                <div>
                  <label>Startdato</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div>
                  <label>Slutdato</label>
                  <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>

              {/* Dashboard display */}
              <div>
                <label>Dashboard viser</label>
                <select value={form.display_mode} onChange={e => setForm(f => ({ ...f, display_mode: e.target.value }))}>
                  <option value="COUNT">Antal salg (f.eks. mødebooking)</option>
                  <option value="AMOUNT">Beløb lukket (f.eks. fundraising)</option>
                </select>
              </div>

              {/* Compensation model */}
              <div>
                <label>Kompensationsmodel</label>
                <select value={form.compensation_model} onChange={e => setForm(f => ({ ...f, compensation_model: e.target.value, packages: [] }))}>
                  <option value="FIXED">Fast (pris pr. unit)</option>
                  <option value="PERCENT">Procent af deal</option>
                  <option value="PACKAGE">Pakker</option>
                </select>
              </div>
              {form.compensation_model === 'FIXED' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label>Pris pr. unit (kr)</label>
                    <input type="number" min="0" value={form.price_per_unit} onChange={e => setForm(f => ({ ...f, price_per_unit: e.target.value }))} required placeholder="0" />
                  </div>
                  <div>
                    <label>Sælgerlabel</label>
                    <input value={form.units_label} onChange={e => setForm(f => ({ ...f, units_label: e.target.value }))} placeholder="Antal møder" />
                  </div>
                </div>
              )}
              {form.compensation_model === 'PERCENT' && (
                <div>
                  <label>Procent af deal (%)</label>
                  <input type="number" min="0" max="100" step="0.01" value={form.percent_value} onChange={e => setForm(f => ({ ...f, percent_value: e.target.value }))} required placeholder="0.00" />
                </div>
              )}
              {form.compensation_model === 'PACKAGE' && (
                <div>
                  <label>Pakker</label>
                  {form.packages.map((pkg, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input value={pkg.name} onChange={e => updatePackage(i, 'name', e.target.value)} placeholder="Pakkenavn" style={{ flex: 2 }} />
                      <input type="number" value={pkg.price} onChange={e => updatePackage(i, 'price', e.target.value)} placeholder="Pris" style={{ flex: 1 }} />
                      <button type="button" onClick={() => removePackage(i)} style={{ background: 'rgba(231,76,60,0.15)', color: '#E74C3C', padding: '0 10px', borderRadius: 6, fontSize: 16, lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                  <button type="button" onClick={addPackage} style={{ background: 'rgba(255,255,255,0.06)', color: '#667788', padding: '7px 14px', borderRadius: 6, fontSize: 12 }}>+ Tilføj pakke</button>
                </div>
              )}

              {/* Seller assignment */}
              <div>
                <label>Tilknyttede sælgere</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  {allSellers.filter(u => u.role === 'SELLER').map((s) => {
                    const selected = form.seller_ids.includes(s.id);
                    return (
                      <button key={s.id} type="button" onClick={() => toggleSeller(s.id)} style={{
                        padding: '5px 12px', borderRadius: 6, fontSize: 12,
                        background: selected ? 'rgba(24,95,165,0.25)' : 'rgba(255,255,255,0.06)',
                        border: selected ? '1px solid #185FA5' : '1px solid rgba(255,255,255,0.08)',
                        color: selected ? '#185FA5' : '#667788',
                      }}>{s.name}</button>
                    );
                  })}
                </div>
              </div>

              {error && <div style={{ color: '#E74C3C', fontSize: 12, padding: '8px 12px', background: 'rgba(231,76,60,0.1)', borderRadius: 6 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setModal(null)} style={{ flex: 1, padding: '10px 0', borderRadius: 7, background: 'rgba(255,255,255,0.06)', color: '#667788' }}>Annuller</button>
                <button type="submit" disabled={loading} style={{ flex: 2, padding: '10px 0', borderRadius: 7, background: '#185FA5', color: '#fff', fontWeight: 600 }}>
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
