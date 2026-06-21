'use client';

import { useEffect, useState, useRef } from 'react';

interface SellerMonth {
  id: string; name: string;
  sales_month: number; units_month: number; unit_goal_month: number;
  contacts_month: number;
}
interface TaskRow {
  task_id: string; task_name: string; display_mode: string;
  seller_id: string; seller_name: string;
  sales_count: number; amount_sold: number;
  unit_goal: number | null; revenue_goal: number | null;
}
interface LatestSale { id: string; seller_name: string; created_at: string }
interface Toast { id: number; seller: string }
interface Period { id: string; name: string; start_date: string; end_date: string }

const fmtKr = (n: number) => n.toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' kr';

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '22px 26px' }}>
      <div style={{ fontSize: 11, color: '#667788', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 800, color: '#ECF0F1', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#667788', marginTop: 8 }}>{sub}</div>}
    </div>
  );
}

export default function BoardMaanedPage() {
  const [sellers, setSellers] = useState<SellerMonth[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [period, setPeriod] = useState<Period | null>(null);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [clock, setClock] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastSaleId = useRef<string | null>(null);
  const toastCounter = useRef(0);
  const isFirst = useRef(true);

  async function load() {
    const d = await fetch('/api/board').then(r => r.json());
    setSellers(d.monthly ?? []);
    setTasks(d.tasksMonthly ?? []);
    setPeriod(d.period ?? null);
    setPeriodStart(d.periodStart ?? '');
    setPeriodEnd(d.periodEnd ?? '');

    const ls: LatestSale | null = d.latestSale;
    if (ls) {
      if (!isFirst.current && lastSaleId.current && lastSaleId.current !== ls.id) {
        const id = ++toastCounter.current;
        setToasts(prev => [...prev, { id, seller: ls.seller_name }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
      }
      lastSaleId.current = ls.id;
    }
    isFirst.current = false;
  }

  useEffect(() => {
    load();
    const dataIv = setInterval(load, 8000);
    const clockIv = setInterval(() => {
      setClock(new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => { clearInterval(dataIv); clearInterval(clockIv); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
  const periodLabel = period
    ? `${period.name}`
    : periodStart
      ? `${fmtDate(periodStart)} – ${fmtDate(periodEnd)}`
      : new Date().toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });
  const periodSub = period && `${fmtDate(period.start_date)} – ${fmtDate(period.end_date)}`;

  const totalSales = sellers.reduce((s, r) => s + r.sales_month, 0);
  const totalGoal = sellers.reduce((s, r) => s + r.unit_goal_month, 0);
  const totalContacts = sellers.reduce((s, r) => s + r.contacts_month, 0);
  const totalPct = totalGoal > 0 ? Math.min(100, Math.round(totalSales / totalGoal * 100)) : 0;
  const teamKR = totalContacts > 0 ? (totalSales / totalContacts * 100) : null;

  // Group task rows by task
  const taskGroups = tasks.reduce((acc, row) => {
    if (!acc[row.task_id]) acc[row.task_id] = { name: row.task_name, display_mode: row.display_mode, rows: [] };
    acc[row.task_id].rows.push(row);
    return acc;
  }, {} as Record<string, { name: string; display_mode: string; rows: TaskRow[] }>);

  return (
    <div style={{ minHeight: '100vh', background: '#0F1923', padding: '32px 48px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Sale toasts */}
      <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: 'linear-gradient(135deg, #0F6E56, #2ECC71)',
            borderRadius: 12, padding: '16px 24px',
            boxShadow: '0 8px 32px rgba(46,204,113,0.35)',
            display: 'flex', alignItems: 'center', gap: 14,
            animation: 'slideIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            <span style={{ fontSize: 28 }}>🎉</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '0.02em' }}>NYT SALG!</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginTop: 2 }}>{t.seller} har lukket et salg</div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 12, color: '#185FA5', fontWeight: 700, letterSpacing: '0.12em', marginBottom: 6 }}>NEXT LEVEL SALES</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#ECF0F1' }}>{periodLabel}</div>
          {periodSub && <div style={{ fontSize: 12, color: '#667788', marginTop: 4 }}>{periodSub}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#ECF0F1', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>{clock}</div>
          <div style={{ fontSize: 11, color: '#667788', marginTop: 4 }}>Opdateres hvert 8 sek.</div>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <KpiCard label="SALG DENNE MÅNED" value={String(totalSales)} sub={totalGoal > 0 ? `Mål: ${totalGoal}` : 'Intet holdmål sat'} />
        <KpiCard label="FREMGANG" value={totalGoal > 0 ? `${totalPct}%` : '—'} sub={totalGoal > 0 ? `${totalSales} af ${totalGoal}` : undefined} />
        <KpiCard label="KONTAKTER" value={String(totalContacts)} sub={`${sellers.length} sælgere`} />
        <KpiCard label="HOLDETS KONV. RATE" value={teamKR !== null ? `${teamKR.toFixed(1)}%` : '—'} sub={teamKR !== null ? `${totalSales} salg / ${totalContacts} kontakter` : 'Ingen kontakter endnu'} />
      </div>

      {/* Team progress bar */}
      {totalGoal > 0 && (
        <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '18px 26px', marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: '#667788', fontWeight: 700, letterSpacing: '0.08em' }}>HOLDETS SAMLEDE FREMGANG</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: totalPct >= 100 ? '#2ECC71' : '#185FA5', fontVariantNumeric: 'tabular-nums' }}>{totalPct}%</span>
          </div>
          <div style={{ height: 16, background: 'rgba(255,255,255,0.07)', borderRadius: 8 }}>
            <div style={{
              height: '100%', borderRadius: 8, transition: 'width 0.6s',
              width: `${totalPct}%`,
              background: totalPct >= 100 ? '#2ECC71' : 'linear-gradient(90deg, #185FA5, #1E7AC5)',
            }} />
          </div>
        </div>
      )}

      {/* Per-task sections */}
      {Object.values(taskGroups).map(group => {
        const isAmount = group.display_mode === 'AMOUNT';
        const sortedRows = [...group.rows].sort((a, b) => {
          const aVal = isAmount ? Number(a.amount_sold) : a.sales_count;
          const bVal = isAmount ? Number(b.amount_sold) : b.sales_count;
          return bVal - aVal;
        });
        return (
          <div key={group.name} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#ECF0F1' }}>{group.name}</span>
              <span style={{
                fontSize: 11, padding: '3px 9px', borderRadius: 4, fontWeight: 600,
                background: isAmount ? 'rgba(15,110,86,0.2)' : 'rgba(24,95,165,0.2)',
                color: isAmount ? '#2ECC71' : '#185FA5',
              }}>
                {isAmount ? 'BELØB LUKKET' : 'ANTAL SALG'}
              </span>
            </div>
            <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 120px', gap: 16, padding: '10px 22px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Sælger', isAmount ? 'Beløb lukket' : 'Antal salg', 'Mål'].map(h => (
                  <div key={h} style={{ fontSize: 11, color: '#667788', fontWeight: 600, letterSpacing: '0.05em' }}>{h}</div>
                ))}
              </div>
              {sortedRows.map((row, i) => {
                const actual = isAmount ? Number(row.amount_sold) : row.sales_count;
                const goal = isAmount ? Number(row.revenue_goal ?? 0) : Number(row.unit_goal ?? 0);
                const pct = goal > 0 ? Math.min(100, Math.round(actual / goal * 100)) : 0;
                const done = pct >= 100;
                return (
                  <div key={row.seller_id} style={{
                    display: 'grid', gridTemplateColumns: '200px 1fr 120px',
                    gap: 16, padding: '16px 22px', alignItems: 'center',
                    borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined,
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#ECF0F1' }}>{row.seller_name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: done ? '#2ECC71' : '#ECF0F1', fontVariantNumeric: 'tabular-nums', minWidth: 80 }}>
                        {isAmount ? fmtKr(actual) : actual}
                      </span>
                      {goal > 0 && (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4 }}>
                            <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: done ? '#2ECC71' : '#185FA5', transition: 'width 0.5s' }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: done ? '#2ECC71' : '#667788', minWidth: 36, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: '#667788', fontVariantNumeric: 'tabular-nums' }}>
                      {goal > 0 ? (isAmount ? fmtKr(goal) : String(goal)) : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Summary seller table */}
      {sellers.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: '#667788', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 12 }}>SAMLET PR. SÆLGER</div>
          <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '180px 80px 80px 1fr 100px 100px', gap: 16, padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['Sælger', 'Salg', 'Mål', 'Fremgang', 'Kontakter', 'KR%'].map(h => (
                <div key={h} style={{ fontSize: 11, color: '#667788', fontWeight: 600, letterSpacing: '0.05em' }}>{h}</div>
              ))}
            </div>
            {sellers.map((s, i) => {
              const pct = s.unit_goal_month > 0 ? Math.min(100, Math.round(s.sales_month / s.unit_goal_month * 100)) : 0;
              const done = pct >= 100;
              const kr = s.contacts_month > 0 ? (s.sales_month / s.contacts_month * 100) : null;
              return (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '180px 80px 80px 1fr 100px 100px', gap: 16, padding: '16px 24px', alignItems: 'center', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#ECF0F1' }}>{s.name}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: done ? '#2ECC71' : '#ECF0F1', fontVariantNumeric: 'tabular-nums' }}>{s.sales_month}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#667788', fontVariantNumeric: 'tabular-nums' }}>{s.unit_goal_month > 0 ? s.unit_goal_month : '—'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4 }}>
                      <div style={{ height: '100%', borderRadius: 4, width: s.unit_goal_month > 0 ? `${pct}%` : '0%', background: done ? '#2ECC71' : '#185FA5', transition: 'width 0.5s' }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: done ? '#2ECC71' : '#667788', minWidth: 36, fontVariantNumeric: 'tabular-nums' }}>{s.unit_goal_month > 0 ? `${pct}%` : '—'}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#667788', fontVariantNumeric: 'tabular-nums' }}>{s.contacts_month}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: kr !== null ? '#185FA5' : '#334455', fontVariantNumeric: 'tabular-nums' }}>{kr !== null ? `${kr.toFixed(1)}%` : '—'}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sellers.length === 0 && (
        <div style={{ color: '#667788', fontSize: 14, textAlign: 'center', padding: 60 }}>Ingen sælgere endnu</div>
      )}
    </div>
  );
}
