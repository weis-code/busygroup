'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const fmt = (n: number) => Number(n).toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' kr';

interface ChartItem { label: string; value: number }
interface RevenueData {
  totals: { this_month: number; last_month: number };
  byTask: ChartItem[]; bySeller: ChartItem[]; byModel: ChartItem[];
}

export default function RevenuePage() {
  const [data, setData]         = useState<RevenueData | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    fetch('/api/admin/revenue').then(r => {
      if (r.status === 403) { setForbidden(true); return null; }
      return r.json() as Promise<RevenueData>;
    }).then(d => { if (d) setData(d); });
  }, []);

  if (forbidden) return <div style={{ padding: '40px 32px', color: 'var(--t3)', fontSize: 14 }}>Du har ikke adgang til omsætningsoversigten. Kræver ADMIN-rolle.</div>;
  if (!data) return <div style={{ padding: 40, color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>;

  const { totals, byTask, bySeller, byModel } = data;
  const change = totals.last_month > 0 ? ((totals.this_month / totals.last_month - 1) * 100) : null;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 28 }}>Omsætning</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Denne måned',   value: fmt(Number(totals.this_month)),  accent: 'var(--bl)' },
          { label: 'Forrige måned', value: fmt(Number(totals.last_month)),  accent: 'var(--pu)' },
          { label: 'Vækst',         value: change === null ? '—' : (change >= 0 ? '+' : '') + change.toFixed(1) + '%', accent: change === null ? 'var(--t3)' : change >= 0 ? 'var(--gr)' : 'var(--re)' },
        ].map(k => (
          <div key={k.label} className="kpi-tile" style={{ '--accent': k.accent } as React.CSSProperties}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ fontSize: 24 }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {[
          { title: 'Pr. opgave',              d: byTask },
          { title: 'Pr. sælger',              d: bySeller },
          { title: 'Pr. kompensationsmodel',  d: byModel },
        ].map(({ title, d }) => (
          <div key={title} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>{title}</div>
            {d.length === 0 ? (
              <div style={{ color: 'var(--t3)', fontSize: 12, paddingBottom: 16 }}>Ingen data</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(120, d.length * 36)}>
                <BarChart data={d} barSize={16} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#4a5d78', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(Number(v)/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="label" tick={{ fill: '#8899b5', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ background: 'var(--s2)', border: '1px solid var(--bd2)', borderRadius: 8, color: 'var(--t1)', fontSize: 12 }} cursor={{ fill: 'var(--bl3)' }} />
                  <Bar dataKey="value" fill="var(--gr)" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
