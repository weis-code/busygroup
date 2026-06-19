'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const fmt = (n: number) => Number(n).toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' kr';

interface ChartItem { label: string; value: number }
interface RevenueData {
  totals: { this_month: number; last_month: number };
  byTask: ChartItem[];
  bySeller: ChartItem[];
  byModel: ChartItem[];
}

export default function RevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    fetch('/api/admin/revenue').then(r => {
      if (r.status === 403) { setForbidden(true); return null; }
      return r.json() as Promise<RevenueData>;
    }).then(d => { if (d) setData(d); });
  }, []);

  if (forbidden) {
    return (
      <div style={{ padding: '40px 32px', color: '#667788', fontSize: 14 }}>
        Du har ikke adgang til omsætningsoversigten. Kræver ADMIN-rolle.
      </div>
    );
  }

  if (!data) return <div style={{ padding: 40, color: '#667788', fontSize: 13 }}>Indlæser…</div>;

  const { totals, byTask, bySeller, byModel } = data;
  const change = totals.last_month > 0 ? ((totals.this_month / totals.last_month - 1) * 100) : null;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 28 }}>Omsætning</h1>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 32 }}>
        <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '22px 24px' }}>
          <div style={{ fontSize: 11, color: '#667788', letterSpacing: '0.06em', marginBottom: 8 }}>DENNE MÅNED</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#ECF0F1' }}>{fmt(Number(totals.this_month))}</div>
        </div>
        <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '22px 24px' }}>
          <div style={{ fontSize: 11, color: '#667788', letterSpacing: '0.06em', marginBottom: 8 }}>FORRIGE MÅNED</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#ECF0F1' }}>{fmt(Number(totals.last_month))}</div>
        </div>
        <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '22px 24px' }}>
          <div style={{ fontSize: 11, color: '#667788', letterSpacing: '0.06em', marginBottom: 8 }}>VÆKST</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: change === null ? '#667788' : change >= 0 ? '#2ECC71' : '#E74C3C' }}>
            {change === null ? '—' : (change >= 0 ? '+' : '') + change.toFixed(1) + '%'}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {[
          { title: 'PR. OPGAVE', d: byTask },
          { title: 'PR. SÆLGER', d: bySeller },
          { title: 'PR. KOMPENSATIONSMODEL', d: byModel },
        ].map(({ title, d }) => (
          <div key={title} style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '20px 20px' }}>
            <div style={{ fontSize: 11, color: '#667788', marginBottom: 16, letterSpacing: '0.05em' }}>{title}</div>
            {d.length === 0 ? (
              <div style={{ color: '#667788', fontSize: 12, paddingBottom: 16 }}>Ingen data</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(120, d.length * 36)}>
                <BarChart data={d} barSize={18} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#667788', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(Number(v)/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="label" tick={{ fill: '#ECF0F1', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ background: '#1A2A38', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#ECF0F1', fontSize: 12 }} cursor={{ fill: 'rgba(24,95,165,0.1)' }} />
                  <Bar dataKey="value" fill="#0F6E56" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
