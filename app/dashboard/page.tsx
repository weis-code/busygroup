'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface DailyCall { date: string; calls: number }
interface RecentSale { id: string; date: string; task_name: string; compensation_model: string; units: number | null; deal_size: number | null; package_name: string | null; status: string; cvr: string | null; company_name: string | null }
interface Target { id: string; task_name: string; unit_goal: number | null; revenue_goal: number | null; units_sold: number; amount_sold: number; display_mode: string }
interface Period { id: string; name: string; start_date: string; end_date: string }
interface DashboardData { dailyCalls: DailyCall[]; recentSales: RecentSale[]; activePeriod: Period | null; targets: Target[]; calls_today: number; contacts_today: number; sales_today: number }

const STATUS_COLOR: Record<string, string> = { PENDING: '#F39C12', CONFIRMED: '#2ECC71', PAID: '#185FA5' };
const STATUS_DK: Record<string, string> = { PENDING: 'Afventer', CONFIRMED: 'Bekræftet', PAID: 'Betalt' };
const fmtKr = (n: number) => n.toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' kr';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(setData);
  }, []);

  if (!data) return <div style={{ padding: 40, color: '#667788', fontSize: 13 }}>Indlæser…</div>;

  const { dailyCalls, recentSales, activePeriod, targets, calls_today, contacts_today, sales_today } = data;

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
      <p style={{ fontSize: 13, color: '#667788', marginBottom: 28 }}>I dag</p>

      {/* Today's quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'OPKALD I DAG', value: calls_today },
          { label: 'KONTAKTER I DAG', value: contacts_today },
          { label: 'SALG I DAG', value: sales_today },
        ].map(k => (
          <div key={k.label} style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '20px 22px' }}>
            <div style={{ fontSize: 11, color: '#667788', letterSpacing: '0.06em', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#ECF0F1', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Period targets */}
      {activePeriod && targets.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, color: '#667788', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 12 }}>
            AKTIV LØNPERIODE — {activePeriod.name}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {targets.map(tg => {
              const isAmount = tg.display_mode === 'AMOUNT';
              const actual = isAmount ? Number(tg.amount_sold) : tg.units_sold;
              const goal = isAmount ? Number(tg.revenue_goal ?? 0) : Number(tg.unit_goal ?? 0);
              const pct = goal > 0 ? Math.min(100, Math.round(actual / goal * 100)) : 0;
              const done = pct >= 100;
              return (
                <div key={tg.id} style={{
                  background: '#111E2A',
                  border: `1px solid ${done ? 'rgba(46,204,113,0.25)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 10, padding: '18px 20px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#ECF0F1', marginBottom: 3 }}>{tg.task_name}</div>
                      <span style={{
                        fontSize: 10, padding: '2px 7px', borderRadius: 4, fontWeight: 600,
                        background: isAmount ? 'rgba(15,110,86,0.2)' : 'rgba(24,95,165,0.2)',
                        color: isAmount ? '#2ECC71' : '#185FA5',
                      }}>
                        {isAmount ? 'BELØB' : 'ANTAL SALG'}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: done ? '#2ECC71' : '#ECF0F1', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                        {isAmount ? fmtKr(actual) : actual}
                      </div>
                      {goal > 0 && (
                        <div style={{ fontSize: 12, color: '#667788', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                          / {isAmount ? fmtKr(goal) : goal}
                        </div>
                      )}
                    </div>
                  </div>
                  {goal > 0 && (
                    <>
                      <div style={{ height: 7, background: 'rgba(255,255,255,0.08)', borderRadius: 4, marginBottom: 6 }}>
                        <div style={{
                          height: '100%', borderRadius: 4, width: `${pct}%`,
                          background: done ? '#2ECC71' : '#185FA5', transition: 'width 0.4s',
                        }} />
                      </div>
                      <div style={{ fontSize: 12, color: done ? '#2ECC71' : '#667788', fontVariantNumeric: 'tabular-nums' }}>
                        {pct}% af mål
                      </div>
                    </>
                  )}
                  {goal === 0 && <div style={{ fontSize: 12, color: '#667788' }}>Intet mål sat</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activePeriod && targets.length === 0 && (
        <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '20px 22px', marginBottom: 28 }}>
          <div style={{ fontSize: 12, color: '#667788', marginBottom: 4, letterSpacing: '0.05em' }}>AKTIV LØNPERIODE</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#ECF0F1' }}>{activePeriod.name}</div>
          <div style={{ fontSize: 12, color: '#667788', marginTop: 8 }}>Ingen targets sat endnu</div>
        </div>
      )}

      {/* Calls chart */}
      <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '20px 22px', marginBottom: 28 }}>
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

      {/* Recent sales */}
      <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '20px 22px' }}>
        <div style={{ fontSize: 12, color: '#667788', marginBottom: 16, letterSpacing: '0.05em' }}>SENESTE 10 SALG</div>
        {recentSales.length === 0 && <div style={{ fontSize: 13, color: '#667788' }}>Ingen salg endnu</div>}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Dato', 'Opgave', 'Firma', 'Detalje', 'Status'].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: 11, color: '#667788', paddingBottom: 10, fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentSales.map(s => (
              <tr key={s.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '10px 0', fontSize: 13, color: '#ECF0F1', whiteSpace: 'nowrap' }}>{s.date}</td>
                <td style={{ padding: '10px 8px', fontSize: 13, color: '#ECF0F1' }}>{s.task_name}</td>
                <td style={{ fontSize: 13, color: '#667788' }}>{s.company_name || '—'}</td>
                <td style={{ fontSize: 12, color: '#667788' }}>
                  {s.compensation_model === 'FIXED' && `${s.units} stk`}
                  {s.compensation_model === 'PERCENT' && fmtKr(Number(s.deal_size ?? 0))}
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
