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
interface Toast      { id: number; seller: string }
interface Period     { id: string; name: string; start_date: string; end_date: string }

const fmtKr = (n: number) => n.toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' kr';

const TYPE_STYLE = {
  COUNT:  { accent: 'var(--bl)', accentBg: 'var(--bl2)',  label: 'ANTAL SALG',   border: 'var(--bl)' },
  AMOUNT: { accent: 'var(--gr)', accentBg: 'var(--gr2)', label: 'BELØB LUKKET', border: 'var(--gr)' },
};

export default function BoardMaanedPage() {
  const [sellers, setSellers]       = useState<SellerMonth[]>([]);
  const [tasks, setTasks]           = useState<TaskRow[]>([]);
  const [period, setPeriod]         = useState<Period | null>(null);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd]     = useState('');
  const [clock, setClock]           = useState('');
  const [toasts, setToasts]         = useState<Toast[]>([]);
  const lastSaleId   = useRef<string | null>(null);
  const toastCounter = useRef(0);
  const isFirst      = useRef(true);

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
    const dataIv  = setInterval(load, 8000);
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

  const taskGroups = tasks.reduce((acc, row) => {
    if (!acc[row.task_id]) acc[row.task_id] = { name: row.task_name, display_mode: row.display_mode, rows: [] };
    acc[row.task_id].rows.push(row);
    return acc;
  }, {} as Record<string, { name: string; display_mode: string; rows: TaskRow[] }>);

  const countGroups  = Object.values(taskGroups).filter(g => g.display_mode !== 'AMOUNT');
  const amountGroups = Object.values(taskGroups).filter(g => g.display_mode === 'AMOUNT');

  const totalCountActual  = countGroups.flatMap(g => g.rows).reduce((s, r) => s + r.sales_count, 0);
  const totalCountGoal    = countGroups.flatMap(g => g.rows).reduce((s, r) => s + Number(r.unit_goal ?? 0), 0);
  const totalAmountActual = amountGroups.flatMap(g => g.rows).reduce((s, r) => s + Number(r.amount_sold), 0);
  const totalAmountGoal   = amountGroups.flatMap(g => g.rows).reduce((s, r) => s + Number(r.revenue_goal ?? 0), 0);

  const totalContacts    = sellers.reduce((s, r) => s + r.contacts_month, 0);
  const totalCountSales  = sellers.reduce((s, r) => s + r.sales_month, 0);
  const teamKR           = totalContacts > 0 ? (totalCountSales / totalContacts * 100) : null;

  const countPct  = totalCountGoal  > 0 ? Math.min(100, Math.round(totalCountActual  / totalCountGoal  * 100)) : 0;
  const amountPct = totalAmountGoal > 0 ? Math.min(100, Math.round(totalAmountActual / totalAmountGoal * 100)) : 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '32px 48px' }}>

      {/* Toasts */}
      <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: 'linear-gradient(135deg, var(--gr), var(--bl))',
            borderRadius: 12, padding: '16px 24px',
            boxShadow: '0 8px 32px rgba(45,212,160,0.35)',
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
          <div style={{ fontSize: 12, color: 'var(--bl)', fontWeight: 700, letterSpacing: '0.12em', marginBottom: 6 }}>BUSYGROUP SALES</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--t1)' }}>{periodLabel}</div>
          {periodSub && <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>{periodSub}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--t1)', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>{clock}</div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>Opdateres hvert 8 sek.</div>
        </div>
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 }}>
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '22px 26px' }}>
          <div style={{ fontSize: 11, color: 'var(--t3)', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 10 }}>KONTAKTER</div>
          <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--t1)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{totalContacts}</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 8 }}>{sellers.length} sælgere</div>
        </div>

        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '22px 26px' }}>
          <div style={{ fontSize: 11, color: 'var(--t3)', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 10 }}>KONVERTERINGSRATE</div>
          <div style={{ fontSize: 34, fontWeight: 800, color: teamKR !== null ? 'var(--bl)' : 'var(--t4)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {teamKR !== null ? teamKR.toFixed(1) + '%' : '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 8 }}>
            {teamKR !== null ? `${totalCountSales} salg / ${totalContacts} kontakter` : 'Ingen kontakter endnu'}
          </div>
        </div>

        <div style={{ background: 'var(--s1)', border: `1px solid ${TYPE_STYLE.COUNT.border}55`, borderRadius: 12, padding: '22px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--t3)', letterSpacing: '0.08em', fontWeight: 600 }}>ANTAL SALG — HOLD</div>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_STYLE.COUNT.accent, flexShrink: 0 }} />
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, color: countPct >= 100 ? 'var(--gr)' : 'var(--t1)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {totalCountActual}
          </div>
          {totalCountGoal > 0 ? (
            <>
              <div style={{ height: 4, background: 'var(--bd)', borderRadius: 2, marginTop: 12, marginBottom: 6 }}>
                <div style={{ height: '100%', borderRadius: 2, width: `${countPct}%`, background: countPct >= 100 ? 'var(--gr)' : TYPE_STYLE.COUNT.accent, transition: 'width 0.6s' }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--t3)' }}>{countPct}% af mål {totalCountGoal}</div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 8 }}>Intet holdmål sat</div>
          )}
        </div>

        <div style={{ background: 'var(--s1)', border: `1px solid ${TYPE_STYLE.AMOUNT.border}55`, borderRadius: 12, padding: '22px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--t3)', letterSpacing: '0.08em', fontWeight: 600 }}>BELØB LUKKET — HOLD</div>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_STYLE.AMOUNT.accent, flexShrink: 0 }} />
          </div>
          <div style={{ fontSize: amountGroups.length > 0 ? 26 : 34, fontWeight: 800, color: amountPct >= 100 ? 'var(--gr)' : 'var(--t1)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {amountGroups.length > 0 ? fmtKr(totalAmountActual) : '—'}
          </div>
          {totalAmountGoal > 0 ? (
            <>
              <div style={{ height: 4, background: 'var(--bd)', borderRadius: 2, marginTop: 12, marginBottom: 6 }}>
                <div style={{ height: '100%', borderRadius: 2, width: `${amountPct}%`, background: amountPct >= 100 ? 'var(--gr)' : TYPE_STYLE.AMOUNT.accent, transition: 'width 0.6s' }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--t3)' }}>{amountPct}% af mål {fmtKr(totalAmountGoal)}</div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 8 }}>
              {amountGroups.length > 0 ? 'Intet holdmål sat' : 'Ingen beløbsopgaver'}
            </div>
          )}
        </div>
      </div>

      {/* Per-task sections */}
      {Object.values(taskGroups).map(group => {
        const isAmount  = group.display_mode === 'AMOUNT';
        const style     = isAmount ? TYPE_STYLE.AMOUNT : TYPE_STYLE.COUNT;
        const sortedRows = [...group.rows].sort((a, b) => {
          const aVal = isAmount ? Number(a.amount_sold) : a.sales_count;
          const bVal = isAmount ? Number(b.amount_sold) : b.sales_count;
          return bVal - aVal;
        });
        return (
          <div key={group.name} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 4, height: 20, borderRadius: 2, background: style.accent, flexShrink: 0 }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>{group.name}</span>
              <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 4, fontWeight: 700, background: style.accentBg, color: style.accent, letterSpacing: '0.05em' }}>
                {style.label}
              </span>
            </div>

            <div style={{ background: 'var(--s1)', border: `1px solid ${style.border}55`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 120px', gap: 16, padding: '10px 22px', borderBottom: `1px solid ${style.border}33`, background: 'var(--bd)' }}>
                {['Sælger', isAmount ? 'Beløb lukket' : 'Antal salg', 'Mål'].map(h => (
                  <div key={h} style={{ fontSize: 11, color: style.accent, fontWeight: 700, letterSpacing: '0.05em' }}>{h}</div>
                ))}
              </div>
              {sortedRows.map((row, i) => {
                const actual = isAmount ? Number(row.amount_sold) : row.sales_count;
                const goal   = isAmount ? Number(row.revenue_goal ?? 0) : Number(row.unit_goal ?? 0);
                const pct    = goal > 0 ? Math.min(100, Math.round(actual / goal * 100)) : 0;
                const done   = pct >= 100;
                return (
                  <div key={row.seller_id} style={{
                    display: 'grid', gridTemplateColumns: '200px 1fr 120px',
                    gap: 16, padding: '16px 22px', alignItems: 'center',
                    borderTop: i > 0 ? '1px solid var(--bd)' : undefined,
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{row.seller_name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: done ? 'var(--gr)' : 'var(--t1)', fontVariantNumeric: 'tabular-nums', minWidth: 90 }}>
                        {isAmount ? fmtKr(actual) : actual}
                      </span>
                      {goal > 0 && (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 8, background: 'var(--bd)', borderRadius: 4 }}>
                            <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: done ? 'var(--gr)' : style.accent, transition: 'width 0.5s' }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: done ? 'var(--gr)' : style.accent, minWidth: 36, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--t3)', fontVariantNumeric: 'tabular-nums' }}>
                      {goal > 0 ? (isAmount ? fmtKr(goal) : String(goal)) : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {sellers.length === 0 && (
        <div style={{ color: 'var(--t3)', fontSize: 14, textAlign: 'center', padding: 60 }}>Ingen sælgere endnu</div>
      )}
    </div>
  );
}
