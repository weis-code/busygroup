'use client';

import { useEffect, useState, FormEvent } from 'react';

const STATUS_COLOR: Record<string, string> = { PENDING: '#F39C12', CONFIRMED: '#2ECC71', PAID: '#185FA5' };
const STATUS_DK: Record<string, string> = { PENDING: 'Afventer', CONFIRMED: 'Bekræftet', PAID: 'Betalt' };

interface Task { id: string; name: string; client: string; compensation_model: string; price_per_unit: number | null; percent_value: number | null; units_label: string }
interface Package { id: string; task_id: string; name: string; price: number }
interface Sale { id: string; date: string; task_name: string; compensation_model: string; units: number | null; deal_size: number | null; package_name: string | null; cvr: string | null; company_name: string | null; status: string; note: string | null }

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const [taskId, setTaskId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [cvr, setCvr] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [units, setUnits] = useState('');
  const [dealSize, setDealSize] = useState('');
  const [packageId, setPackageId] = useState('');
  const [note, setNote] = useState('');

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 4 }}>Mine salg</h1>
          <p style={{ fontSize: 13, color: '#667788' }}>{sales.length} registreringer</p>
        </div>
        <button onClick={() => { resetForm(); setOpen(true); }} style={{
          background: '#185FA5', color: '#fff', padding: '10px 18px', borderRadius: 8, fontWeight: 600, fontSize: 13,
        }}>+ Nyt salg</button>
      </div>

      <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['Dato', 'Opgave', 'Firma', 'CVR', 'Detalje', 'Status', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '14px 18px', fontSize: 11, color: '#667788', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '40px 18px', textAlign: 'center', color: '#667788', fontSize: 13 }}>Ingen salg endnu</td></tr>
            )}
            {sales.map(s => (
              <tr key={s.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '12px 18px', fontSize: 13, color: '#ECF0F1', whiteSpace: 'nowrap' }}>{s.date}</td>
                <td style={{ padding: '12px 18px', fontSize: 13, color: '#ECF0F1' }}>{s.task_name}</td>
                <td style={{ padding: '12px 18px', fontSize: 13, color: '#ECF0F1' }}>{s.company_name || '—'}</td>
                <td style={{ padding: '12px 18px', fontSize: 12, color: '#667788', fontVariantNumeric: 'tabular-nums' }}>{s.cvr || '—'}</td>
                <td style={{ padding: '12px 18px', fontSize: 12, color: '#667788' }}>
                  {s.compensation_model === 'FIXED' && `${s.units} units`}
                  {s.compensation_model === 'PERCENT' && `${Number(s.deal_size).toLocaleString('da-DK')} kr`}
                  {s.compensation_model === 'PACKAGE' && `${s.package_name}`}
                </td>
                <td style={{ padding: '12px 18px' }}>
                  <span style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 4,
                    background: `${STATUS_COLOR[s.status]}22`, color: STATUS_COLOR[s.status], fontWeight: 600,
                  }}>{STATUS_DK[s.status]}</span>
                </td>
                <td style={{ padding: '12px 18px' }}>
                  <button
                    onClick={() => deleteSale(s.id)}
                    disabled={deleting === s.id}
                    style={{
                      background: 'rgba(231,76,60,0.1)', color: '#E74C3C',
                      border: '1px solid rgba(231,76,60,0.2)',
                      padding: '4px 10px', borderRadius: 6, fontSize: 12,
                      cursor: 'pointer', opacity: deleting === s.id ? 0.5 : 1,
                    }}>
                    Slet
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1A2A38', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 28, width: 440, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#ECF0F1', marginBottom: 22 }}>Registrer salg</div>

            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label>Dato</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div>
                <label>Opgave</label>
                <select value={taskId} onChange={e => { setTaskId(e.target.value); setPackageId(''); }} required>
                  <option value="">Vælg opgave…</option>
                  {tasks.map(t => <option key={t.id} value={t.id}>{t.name} — {t.client}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label>CVR-nummer</label>
                  <input value={cvr} onChange={e => setCvr(e.target.value)} required placeholder="12345678" />
                </div>
                <div>
                  <label>Firmanavn</label>
                  <input value={companyName} onChange={e => setCompanyName(e.target.value)} required placeholder="Firma A/S" />
                </div>
              </div>

              {selectedTask?.compensation_model === 'FIXED' && (
                <div>
                  <label>{selectedTask.units_label || 'Antal'}</label>
                  <input type="number" min="1" value={units} onChange={e => setUnits(e.target.value)} required placeholder="1" />
                </div>
              )}
              {selectedTask?.compensation_model === 'PERCENT' && (
                <div>
                  <label>Beløb (kr)</label>
                  <input type="number" min="0" value={dealSize} onChange={e => setDealSize(e.target.value)} required placeholder="0" />
                </div>
              )}
              {selectedTask?.compensation_model === 'PACKAGE' && (
                <div>
                  <label>Pakke</label>
                  <select value={packageId} onChange={e => setPackageId(e.target.value)} required>
                    <option value="">Vælg pakke…</option>
                    {taskPackages.map(p => <option key={p.id} value={p.id}>{p.name} — {Number(p.price).toLocaleString('da-DK')} kr</option>)}
                  </select>
                </div>
              )}

              <div>
                <label>Note (valgfri)</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Evt. bemærkning…" />
              </div>

              {error && <div style={{ color: '#E74C3C', fontSize: 12, padding: '8px 12px', background: 'rgba(231,76,60,0.1)', borderRadius: 6 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setOpen(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 7, background: 'rgba(255,255,255,0.06)', color: '#667788' }}>Annuller</button>
                <button type="submit" disabled={loading} style={{ flex: 2, padding: '10px 0', borderRadius: 7, background: '#185FA5', color: '#fff', fontWeight: 600 }}>
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
