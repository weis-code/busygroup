'use client';

import { useEffect, useState } from 'react';

interface Sale {
  id: string; date: string; created_at: string;
  seller_name: string; task_name: string; display_mode: string; compensation_model: string;
  units: number | null; deal_size: number | null; package_name: string | null;
  house_revenue: number; status: string; cvr: string | null; company_name: string | null; note: string | null;
}

const STATUS_CLR: Record<string, string> = { PENDING: 'var(--ye)', CONFIRMED: 'var(--gr)', PAID: 'var(--bl)' };
const STATUS_BG:  Record<string, string> = { PENDING: 'var(--ye2)', CONFIRMED: 'var(--gr2)', PAID: 'var(--bl2)' };
const fmt = (n: number) => Number(n).toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' kr';

function toDay(offset: number) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export default function AdminSalesPage() {
  const [date, setDate]         = useState(() => new Date().toISOString().slice(0, 10));
  const [sales, setSales]       = useState<Sale[]>([]);
  const [loading, setLoading]   = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  async function load(d: string) {
    setLoading(true);
    const res = await fetch(`/api/admin/sales?date=${d}`).then(r => r.json());
    setSales(res.sales ?? []);
    setLoading(false);
  }

  useEffect(() => { load(date); }, [date]);

  async function changeStatus(id: string, status: string) {
    setUpdating(id);
    await fetch(`/api/sales/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await load(date);
    setUpdating(null);
  }

  function nav(offset: number) {
    const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + offset);
    setDate(d.toISOString().slice(0, 10));
  }

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const totalRev  = sales.reduce((s, r) => s + Number(r.house_revenue), 0);

  return (
    <div style={{ padding: '28px 32px' }}>
      <div className="page-header">
        <h1 className="page-title">Salgshistorik</h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => nav(-1)} className="btn btn-ghost btn-sm">←</button>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        <button onClick={() => nav(1)} disabled={date >= toDay(0)} className="btn btn-ghost btn-sm">→</button>
        <span style={{ fontSize: 13, color: 'var(--t3)', textTransform: 'capitalize' }}>{dateLabel}</span>
        {date === toDay(0) && <span className="badge badge-blue">I DAG</span>}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--t3)' }}>{sales.length} salg · {fmt(totalRev)}</span>
      </div>

      <div className="table-wrap">
        {loading && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>}
        {!loading && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>{['Tidspunkt', 'Sælger', 'Firma / CVR', 'Opgave', 'Hus-rev.', 'Status'].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {sales.length === 0 && (
                  <tr className="empty-row"><td colSpan={6}>Ingen salg denne dag</td></tr>
                )}
                {sales.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {new Date(s.created_at).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="td-primary">{s.seller_name}</td>
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{s.company_name || '—'}</div>
                      {s.cvr && <div style={{ fontSize: 11, color: 'var(--t4)' }}>{s.cvr}</div>}
                    </td>
                    <td>
                      <div style={{ fontSize: 12, color: 'var(--t3)' }}>{s.task_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--t4)' }}>
                        {s.compensation_model === 'FIXED'   && `${s.units} units`}
                        {s.compensation_model === 'PERCENT' && s.deal_size && `${Number(s.deal_size).toLocaleString('da-DK')} kr`}
                        {s.compensation_model === 'PACKAGE' && s.package_name}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(Number(s.house_revenue))}</td>
                    <td>
                      <select
                        value={s.status}
                        disabled={updating === s.id}
                        onChange={e => changeStatus(s.id, e.target.value)}
                        style={{ background: STATUS_BG[s.status], border: `1px solid ${STATUS_CLR[s.status]}55`, color: STATUS_CLR[s.status], borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 700, width: 'auto' }}
                      >
                        <option value="PENDING">Afventer</option>
                        <option value="CONFIRMED">Bekræftet</option>
                        <option value="PAID">Betalt</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
