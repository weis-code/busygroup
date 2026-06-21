'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const fmt = (n: number) => n.toLocaleString('da-DK');
const pct = (a: number, b: number) => b === 0 ? '—' : (a / b * 100).toFixed(1) + '%';

interface Kpi { calls_7d: number; contacts_7d: number; booked_7d: number; held_7d: number; sales_7d: number }
interface DailyCall { date: string; calls: number }
interface RecentSale { id: string; date: string; task_name: string; compensation_model: string; units: number | null; deal_size: number | null; package_name: string | null; status: string }
interface Target { id: string; task_name: string; unit_goal: number | null; revenue_goal: number | null; units_sold: number; amount_sold: number; display_mode: string }
interface Period { id: string; name: string; start_date: string; end_date: string }
interface DashboardData { kpi: Kpi; dailyCalls: DailyCall[]; recentSales: RecentSale[]; activePeriod: Period | null; targets: Target[] }

const STATUS_COLOR: Record<string, string> = { PENDING: '#F39C12', CONFIRMED: '#2ECC71', PAID: '#185FA5' };
const STATUS_DK: Record<string, string> = { PENDING: 'Afventer', CONFIRMED: 'Bekræftet', PAID: 'Betalt' };

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '20px 22px' }}>
      <div style={{ fontSize: 11, color: '#667788', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#ECF0F1', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#667788', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(setData);
  }, []);

  if (!data) return (
    <div style={{ padding: 40, color: '#667788', fontSize: 13 }}>Indlæser…</div>
  );

  const { kpi, dailyCalls, recentSales, activePeriod, targets } = data;

  // Fill missing days in chart
  const callsMap: Record<string, number> = {};
  dailyCalls.forEach(d => { callsMap[d.date] = d.calls; });
  const chartData = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 13 + i);
    const key = d.toISOString().slice(0, 10);
    return { date: key.slice(5), calls: callsMap[key] || 0 };
  });

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 6 }}>Overblik</h1>
      <p style={{ fontSize: 13, color: '#667788', marginBottom: 28 }}>Seneste 7 dage</p>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }}>
        <KpiCard label="OPKALD" value={fmt(kpi.calls_7d)} />
        <KpiCard label="PICKUP RATE" value={pct(kpi.contacts_7d, kpi.calls_7d)} sub={`${kpi.contacts_7d} kontakter`} />
        <KpiCard label="BOOKING RATE" value={pct(kpi.booked_7d, kpi.contacts_7d)} sub={`${kpi.booked_7d} møder booket`} />
        <KpiCard label="SHOW RATE" value={pct(kpi.held_7d, kpi.booked_7d)} sub={`${kpi.held_7d} møder afholdt`} />
        <KpiCard label="CLOSING RATE" value={pct(kpi.sales_7d, kpi.held_7d)} sub={`${kpi.sales_7d} salg`} />
      </div>

      {/* Chart + targets */}
      <div style={{ display: 'grid', gridTemplateColumns: activePeriod ? '2fr 1fr' : '1fr', gap: 16, marginBottom: 28 }}>
        {/* Activity chart */}
        <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '20px 22px' }}>
          <div style={{ fontSize: 12, color: '#667788', marginBottom: 16, letterSpacing: '0.05em' }}>OPKALD PR. DAG — SENESTE 14 DAGE</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barSize={14}>
              <XAxis dataKey="date" tick={{ fill: '#667788', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#667788', fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                contentStyle={{ background: '#1A2A38', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#ECF0F1', fontSize: 12 }}
                cursor={{ fill: 'rgba(24,95,165,0.1)' }}
              />
              <Bar dataKey="calls" fill="#185FA5" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Targets */}
        {activePeriod && (
          <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '20px 22px' }}>
            <div style={{ fontSize: 12, color: '#667788', marginBottom: 4, letterSpacing: '0.05em' }}>AKTIV LØNPERIODE</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#ECF0F1', marginBottom: 16 }}>{activePeriod.name}</div>
            {targets.length === 0 && <div style={{ fontSize: 12, color: '#667788' }}>Ingen targets sat</div>}
            {targets.map((tg) => {
              const isAmount = tg.display_mode === 'AMOUNT';
              const actual = isAmount ? Number(tg.amount_sold) : tg.units_sold;
              const goal = isAmount ? Number(tg.revenue_goal ?? 0) : Number(tg.unit_goal ?? 0);
              const progress = goal > 0 ? Math.min(100, Math.round(actual / goal * 100)) : 0;
              const actualLabel = isAmount
                ? actual.toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' kr'
                : String(actual);
              const goalLabel = isAmount
                ? goal.toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' kr'
                : String(goal);
              return (
                <div key={tg.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                    <span style={{ color: '#ECF0F1' }}>{tg.task_name}</span>
                    {goal > 0
                      ? <span style={{ color: '#667788' }}>{actualLabel} / {goalLabel}</span>
                      : <span style={{ color: '#667788' }}>{actualLabel}</span>
                    }
                  </div>
                  {goal > 0 && (
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${progress}%`, background: progress >= 100 ? '#2ECC71' : '#185FA5', borderRadius: 3, transition: 'width 0.4s' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent sales */}
      <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '20px 22px' }}>
        <div style={{ fontSize: 12, color: '#667788', marginBottom: 16, letterSpacing: '0.05em' }}>SENESTE 10 SALG</div>
        {recentSales.length === 0 && <div style={{ fontSize: 13, color: '#667788' }}>Ingen salg endnu</div>}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Dato', 'Opgave', 'Type', 'Status'].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: 11, color: '#667788', paddingBottom: 10, fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentSales.map((s) => (
              <tr key={s.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '10px 0', fontSize: 13, color: '#ECF0F1' }}>{s.date}</td>
                <td style={{ fontSize: 13, color: '#ECF0F1' }}>{s.task_name}</td>
                <td style={{ fontSize: 12, color: '#667788' }}>
                  {s.compensation_model === 'FIXED' && `${s.units} units`}
                  {s.compensation_model === 'PERCENT' && `${s.deal_size?.toLocaleString('da-DK')} kr`}
                  {s.compensation_model === 'PACKAGE' && s.package_name}
                </td>
                <td>
                  <span style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 4,
                    background: `${STATUS_COLOR[s.status]}22`,
                    color: STATUS_COLOR[s.status], fontWeight: 600,
                  }}>{STATUS_DK[s.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
