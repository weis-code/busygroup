'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface TimeEntry { id?: string; date: string; clocked_in_at: string | null; clocked_out_at: string | null }

function ClockWidget() {
  const [entry, setEntry] = useState<TimeEntry | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  async function load() {
    const d = await fetch('/api/time-entries').then(r => r.json());
    setEntry(d.entry ?? null);
  }

  useEffect(() => { load(); }, []);

  async function clockIn() {
    setLoading(true);
    await fetch('/api/time-entries/clock-in', { method: 'POST' });
    await load();
    setLoading(false);
  }

  async function clockOut() {
    if (!confirm('Stemple ud nu?')) return;
    setLoading(true);
    await fetch('/api/time-entries/clock-out', { method: 'POST' });
    await load();
    setLoading(false);
  }

  const fmtTime = (ts: string) => new Date(ts).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });

  if (entry === undefined) return null;

  const isClockedIn  = !!entry?.clocked_in_at;
  const isClockedOut = !!entry?.clocked_out_at;

  return (
    <div style={{
      background: 'var(--s1)',
      border: `1px solid ${isClockedIn && !isClockedOut ? 'rgba(45,212,160,0.3)' : 'var(--bd)'}`,
      borderRadius: 12, padding: '16px 20px', marginBottom: 24,
      display: 'flex', alignItems: 'center', gap: 20,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: 'var(--t3)', letterSpacing: '0.08em', fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>Stempling i dag</div>
        {!isClockedIn && <div style={{ fontSize: 13, color: 'var(--t2)' }}>Ikke stemplet ind endnu</div>}
        {isClockedIn && (
          <div style={{ fontSize: 13, color: 'var(--t1)' }}>
            Ind <span style={{ fontWeight: 700, color: 'var(--gr)', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(entry!.clocked_in_at!)}</span>
            {isClockedOut && <> · Ud <span style={{ fontWeight: 700, color: 'var(--bl)', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(entry!.clocked_out_at!)}</span></>}
          </div>
        )}
      </div>
      {!isClockedIn && (
        <button onClick={clockIn} disabled={loading} style={{ background: 'var(--gr)', color: '#0d1a14', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
          Stemple ind
        </button>
      )}
      {isClockedIn && !isClockedOut && (
        <button onClick={clockOut} disabled={loading} style={{ background: 'var(--bd)', color: 'var(--t1)', border: '1px solid var(--bd2)', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
          Stemple ud
        </button>
      )}
      {isClockedOut && (
        <span className="badge badge-muted">Stemplet ud</span>
      )}
    </div>
  );
}

interface DailyCall  { date: string; calls: number }
interface RecentSale { id: string; date: string; task_name: string; compensation_model: string; units: number | null; deal_size: number | null; package_name: string | null; status: string; cvr: string | null; company_name: string | null }
interface Target     { id: string; task_name: string; unit_goal: number | null; revenue_goal: number | null; units_sold: number; amount_sold: number; display_mode: string }
interface Period     { id: string; name: string; start_date: string; end_date: string }
interface DashboardData { dailyCalls: DailyCall[]; recentSales: RecentSale[]; activePeriod: Period | null; targets: Target[]; calls_today: number; contacts_today: number; sales_today: number }

const STATUS_BADGE: Record<string, string> = { PENDING: 'badge-yellow', CONFIRMED: 'badge-green', PAID: 'badge-blue' };
const STATUS_DK: Record<string, string>    = { PENDING: 'Afventer', CONFIRMED: 'Bekræftet', PAID: 'Betalt' };
const fmtKr = (n: number) => n.toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' kr';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(setData);
  }, []);

  if (!data) return <div style={{ padding: 40, color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>;

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
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)' }}>Overblik</h1>
        <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 3 }}>I dag</p>
      </div>

      <ClockWidget />

      {/* Today KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Opkald i dag',    value: calls_today,    accent: 'var(--bl)' },
          { label: 'Kontakter i dag', value: contacts_today, accent: 'var(--pu)' },
          { label: 'Salg i dag',      value: sales_today,    accent: 'var(--gr)' },
        ].map(k => (
          <div key={k.label} className="kpi-tile" style={{ '--accent': k.accent } as React.CSSProperties}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Period targets */}
      {activePeriod && targets.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
            Aktiv lønperiode — {activePeriod.name}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {targets.map(tg => {
              const isAmount = tg.display_mode === 'AMOUNT';
              const actual = isAmount ? Number(tg.amount_sold) : tg.units_sold;
              const goal   = isAmount ? Number(tg.revenue_goal ?? 0) : Number(tg.unit_goal ?? 0);
              const pct    = goal > 0 ? Math.min(100, Math.round(actual / goal * 100)) : 0;
              const done   = pct >= 100;
              return (
                <div key={tg.id} style={{
                  background: 'var(--s1)',
                  border: `1px solid ${done ? 'rgba(45,212,160,0.3)' : 'var(--bd)'}`,
                  borderRadius: 12, padding: '18px 20px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 5 }}>{tg.task_name}</div>
                      <span className={`badge ${isAmount ? 'badge-green' : 'badge-blue'}`}>
                        {isAmount ? 'Beløb' : 'Antal salg'}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: done ? 'var(--gr)' : 'var(--t1)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                        {isAmount ? fmtKr(actual) : actual}
                      </div>
                      {goal > 0 && <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>/ {isAmount ? fmtKr(goal) : goal}</div>}
                    </div>
                  </div>
                  {goal > 0 && (
                    <>
                      <div style={{ height: 6, background: 'var(--bd)', borderRadius: 4, marginBottom: 6, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: done ? 'var(--gr)' : 'var(--bl)', transition: 'width 0.4s' }} />
                      </div>
                      <div style={{ fontSize: 11, color: done ? 'var(--gr)' : 'var(--t3)' }}>{pct}% af mål</div>
                    </>
                  )}
                  {goal === 0 && <div style={{ fontSize: 12, color: 'var(--t3)' }}>Intet mål sat</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activePeriod && targets.length === 0 && (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '20px 22px', marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Aktiv lønperiode</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{activePeriod.name}</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6 }}>Ingen targets sat endnu</div>
        </div>
      )}

      {/* Chart */}
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '20px 22px', marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Opkald pr. dag — seneste 14 dage</div>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={chartData} barSize={12}>
            <XAxis dataKey="date" tick={{ fill: '#4a5d78', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#4a5d78', fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
            <Tooltip
              contentStyle={{ background: 'var(--s2)', border: '1px solid var(--bd2)', borderRadius: 8, color: 'var(--t1)', fontSize: 12 }}
              cursor={{ fill: 'var(--bl3)' }}
            />
            <Bar dataKey="calls" fill="var(--bl)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent sales */}
      <div className="table-wrap">
        <div className="card-header">Seneste 10 salg</div>
        {recentSales.length === 0
          ? <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--t3)' }}>Ingen salg endnu</div>
          : (
            <table>
              <thead>
                <tr>
                  {['Dato', 'Opgave', 'Firma', 'Detalje', 'Status'].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {recentSales.map(s => (
                  <tr key={s.id}>
                    <td className="td-primary" style={{ whiteSpace: 'nowrap' }}>{s.date}</td>
                    <td className="td-primary">{s.task_name}</td>
                    <td>{s.company_name || '—'}</td>
                    <td>
                      {s.compensation_model === 'FIXED'   && `${s.units} stk`}
                      {s.compensation_model === 'PERCENT' && fmtKr(Number(s.deal_size ?? 0))}
                      {s.compensation_model === 'PACKAGE' && s.package_name}
                    </td>
                    <td><span className={`badge ${STATUS_BADGE[s.status]}`}>{STATUS_DK[s.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  );
}
