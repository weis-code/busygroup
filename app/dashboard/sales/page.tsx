'use client';

import { useEffect, useState, FormEvent } from 'react';

const STATUS_BADGE: Record<string, string> = { PENDING: 'badge-yellow', CONFIRMED: 'badge-green', PAID: 'badge-blue' };
const STATUS_DK:    Record<string, string> = { PENDING: 'Afventer', CONFIRMED: 'Bekræftet', PAID: 'Betalt' };

interface Task    { id: string; name: string; client: string; compensation_model: string; price_per_unit: number | null; percent_value: number | null; units_label: string }
interface Package { id: string; task_id: string; name: string; price: number }
interface Sale    { id: string; date: string; task_name: string; compensation_model: string; units: number | null; deal_size: number | null; package_name: string | null; cvr: string | null; company_name: string | null; status: string; note: string | null }

export default function SalesPage() {
  const [sales, setSales]       = useState<Sale[]>([]);
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const [taskId, setTaskId]           = useState('');
  const [date, setDate]               = useState(new Date().toISOString().slice(0, 10));
  const [cvr, setCvr]                 = useState('');
  const [companyName, setCompanyName] = useState('');
  const [units, setUnits]             = useState('');
  const [dealSize, setDealSize]       = useState('');
  const [packageId, setPackageId]     = useState('');
  const [note, setNote]               = useState('');

  async function load() {
    const [s, t] = await Promise.all([
      fetch('/api/sales').then(r => r.json()),
      fetch('/api/my-tasks').then(r => r.json()),
    ]);
    setSales(s);
    setTasks(t.tasks || []);
    setPackages(t.packages || []);
  }

  useEffect(() => { load(); }, []);

  const selectedTask = tasks.find(t => t.id === taskId);
  const taskPackages = packages.filter(p => p.task_id === taskId);

  function resetForm() {
    setTaskId(''); setDate(new Date().toISOString().slice(0, 10));
    setCvr(''); setCompanyName('');
    setUnits(''); setDealSize(''); setPackageId(''); setNote(''); setError('');
  }

  async function deleteSale(id: string) {
    if (!confirm('Er du sikker på, at du vil slette dette salg?')) return;
    setDeleting(id);
    await fetch(`/api/sales/${id}`, { method: 'DELETE' });
    setDeleting(null);
    load();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!cvr.trim()) { setError('CVR-nummer er påkrævet'); return; }
    if (!companyName.trim()) { setError('Firmanavn er påkrævet'); return; }
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        task_id: taskId, date,
        cvr: cvr.trim(), company_name: companyName.trim(),
        note: note || null,
      };
      if (selectedTask?.compensation_model === 'FIXED') body.units = Number(units);
      if (selectedTask?.compensation_model === 'PERCENT') body.deal_size = Number(dealSize);
      if (selectedTask?.compensation_model === 'PACKAGE') body.package_id = packageId;

      const res = await fetch('/api/sales', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Fejl'); return; }
      resetForm(); setOpen(false); load();
    } catch { setError('Netværksfejl'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mine salg</h1>
          <p className="page-sub">{sales.length} registreringer</p>
        </div>
        <button onClick={() => { resetForm(); setOpen(true); }} className="btn btn-primary">+ Nyt salg</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {['Dato', 'Opgave', 'Firma', 'CVR', 'Detalje', 'Status', ''].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 && (
              <tr className="empty-row"><td colSpan={7}>Ingen salg endnu</td></tr>
            )}
            {sales.map(s => (
              <tr key={s.id}>
                <td className="td-primary" style={{ whiteSpace: 'nowrap' }}>{s.date}</td>
                <td className="td-primary">{s.task_name}</td>
                <td className="td-primary">{s.company_name || '—'}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{s.cvr || '—'}</td>
                <td>
                  {s.compensation_model === 'FIXED'   && `${s.units} units`}
                  {s.compensation_model === 'PERCENT' && `${Number(s.deal_size).toLocaleString('da-DK')} kr`}
                  {s.compensation_model === 'PACKAGE' && s.package_name}
                </td>
                <td><span className={`badge ${STATUS_BADGE[s.status]}`}>{STATUS_DK[s.status]}</span></td>
                <td>
                  <button onClick={() => deleteSale(s.id)} disabled={deleting === s.id} className="btn btn-danger btn-sm">Slet</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-title">Registrer salg</div>
            <form onSubmit={onSubmit} className="modal-form">
              <div className="form-group">
                <label>Dato</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Opgave</label>
                <select value={taskId} onChange={e => { setTaskId(e.target.value); setPackageId(''); }} required>
                  <option value="">Vælg opgave…</option>
                  {tasks.map(t => <option key={t.id} value={t.id}>{t.name} — {t.client}</option>)}
                </select>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>CVR-nummer</label>
                  <input value={cvr} onChange={e => setCvr(e.target.value)} required placeholder="12345678" />
                </div>
                <div className="form-group">
                  <label>Firmanavn</label>
                  <input value={companyName} onChange={e => setCompanyName(e.target.value)} required placeholder="Firma A/S" />
                </div>
              </div>
              {selectedTask?.compensation_model === 'FIXED' && (
                <div className="form-group">
                  <label>{selectedTask.units_label || 'Antal'}</label>
                  <input type="number" min="1" value={units} onChange={e => setUnits(e.target.value)} required placeholder="1" />
                </div>
              )}
              {selectedTask?.compensation_model === 'PERCENT' && (
                <div className="form-group">
                  <label>Beløb (kr)</label>
                  <input type="number" min="0" value={dealSize} onChange={e => setDealSize(e.target.value)} required placeholder="0" />
                </div>
              )}
              {selectedTask?.compensation_model === 'PACKAGE' && (
                <div className="form-group">
                  <label>Pakke</label>
                  <select value={packageId} onChange={e => setPackageId(e.target.value)} required>
                    <option value="">Vælg pakke…</option>
                    {taskPackages.map(p => <option key={p.id} value={p.id}>{p.name} — {Number(p.price).toLocaleString('da-DK')} kr</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Note (valgfri)</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Evt. bemærkning…" />
              </div>
              {error && <div className="alert-error">{error}</div>}
              <div className="modal-footer">
                <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost" style={{ flex: 1 }}>Annuller</button>
                <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 2 }}>
                  {loading ? 'Gemmer…' : 'Registrer salg'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
