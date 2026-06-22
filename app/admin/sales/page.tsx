'use client';

import { useEffect, useState } from 'react';

interface Sale {
  id: string; date: string; created_at: string;
  seller_name: string; task_name: string; display_mode: string; compensation_model: string;
  units: number | null; deal_size: number | null; package_name: string | null;
  house_revenue: number; status: string; cvr: string | null; company_name: string | null; note: string | null;
}

const STATUS_COLOR: Record<string, string> = { PENDING: '#F39C12', CONFIRMED: '#2ECC71', PAID: '#185FA5' };
const fmt = (n: number) => Number(n).toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' kr';

function toDay(offset: number) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export default function AdminSalesPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
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
  const totalRev = sales.reduce((s, r) => s + Number(r.house_revenue), 0);

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 24 }}>Salgshistorik</h1>

      {/* Date navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => nav(-1)} style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', color: '#ECF0F1', padding: '8px 14px', borderRadius: 7, fontSize: 14 }}>←</button>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 7, fontSize: 13, minWidth: 160 }}
        />
        <button
          onClick={() => nav(1)}
          disabled={date >= toDay(0)}
          style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', color: date >= toDay(0) ? '#334455' : '#ECF0F1', padding: '8px 14px', borderRadius: 7, fontSize: 14 }}
        >→</button>
        <span style={{ fontSize: 14, color: '#667788', textTransform: 'capitalize' }}>{dateLabel}</span>
        {date === toDay(0) && <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'rgba(24,95,165,0.15)', color: '#185FA5', fontWeight: 600 }}>I DAG</span>}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#667788' }}>{sales.length} salg · {fmt(totalRev)}</span>
      </div>

      {/* Table */}
      <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
        {loading && <div style={{ padding: '40px', textAlign: 'center', color: '#667788', fontSize: 13 }}>Indlæser…</div>}
        {!loading && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  {['Tidspunkt', 'Sælger', 'Firma / CVR', 'Opgave', 'Hus-rev.', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, color: '#667788', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '50px', textAlign: 'center', color: '#667788', fontSize: 13 }}>Ingen salg denne dag</td></tr>
                )}
                {sales.map(s => (
                  <tr key={s.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#667788', fontVariantNumeric: 'tabular-nums' }}>
                      {new Date(s.created_at).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#ECF0F1' }}>{s.seller_name}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#ECF0F1' }}>{s.company_name || '—'}</div>
                      {s.cvr && <div style={{ fontSize: 11, color: '#4A5568' }}>{s.cvr}</div>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 12, color: '#667788' }}>{s.task_name}</div>
                      <div style={{ fontSize: 11, color: '#4A5568' }}>
                        {s.compensation_model === 'FIXED' && `${s.units} units`}
                        {s.compensation_model === 'PERCENT' && s.deal_size && `${Number(s.deal_size).toLocaleString('da-DK')} kr`}
                        {s.compensation_model === 'PACKAGE' && s.package_name}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#ECF0F1', fontVariantNumeric: 'tabular-nums' }}>{fmt(Number(s.house_revenue))}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <select
                        value={s.status}
                        disabled={updating === s.id}
                        onChange={e => changeStatus(s.id, e.target.value)}
                        style={{
                          background: `${STATUS_COLOR[s.status]}18`,
                          border: `1px solid ${STATUS_COLOR[s.status]}55`,
                          color: STATUS_COLOR[s.status],
                          borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 600,
                        }}
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
