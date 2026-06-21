'use client';

import { useEffect, useState, useRef } from 'react';

interface SellerMonth {
  id: string; name: string;
  sales_month: number; units_month: number; unit_goal_month: number;
  contacts_month: number;
}
interface LatestSale { id: string; seller_name: string; created_at: string }

interface Toast { id: number; seller: string }

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
  const [data, setData] = useState<SellerMonth[] | null>(null);
  const [clock, setClock] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastSaleId = useRef<string | null>(null);
  const toastCounter = useRef(0);
  const isFirst = useRef(true);

  async function load() {
    const d = await fetch('/api/board').then(r => r.json());
    setData(d.monthly);

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

  const monthName = new Date().toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });
  const sellers = data ?? [];

  const totalSales = sellers.reduce((s, r) => s + r.sales_month, 0);
  const totalGoal = sellers.reduce((s, r) => s + r.unit_goal_month, 0);
  const totalContacts = sellers.reduce((s, r) => s + r.contacts_month, 0);
  const totalPct = totalGoal > 0 ? Math.min(100, Math.round(totalSales / totalGoal * 100)) : 0;
  const teamKR = totalContacts > 0 ? (totalSales / totalContacts * 100) : null;

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
          <div style={{ fontSize: 28, fontWeight: 800, color: '#ECF0F1', textTransform: 'capitalize' }}>{monthName}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#ECF0F1', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>{clock}</div>
          <div style={{ fontSize: 11, color: '#667788', marginTop: 4 }}>Opdateres hvert 8 sek.</div>
        </div>
      </div>

      {/* KPI cards */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
          <KpiCard
            label="SALG DENNE MÅNED"
            value={String(totalSales)}
            sub={totalGoal > 0 ? `Mål: ${totalGoal}` : 'Intet holdmål sat'}
          />
          <KpiCard
            label="FREMGANG"
            value={totalGoal > 0 ? `${totalPct}%` : '—'}
            sub={totalGoal > 0 ? `${totalSales} af ${totalGoal}` : undefined}
          />
          <KpiCard
            label="KONTAKTER"
            value={String(totalContacts)}
            sub={`${sellers.length} sælgere`}
          />
          <KpiCard
            label="HOLDETS KONV. RATE"
            value={teamKR !== null ? `${teamKR.toFixed(1)}%` : '—'}
            sub={teamKR !== null ? `${totalSales} salg / ${totalContacts} kontakter` : 'Ingen kontakter registreret'}
          />
        </div>
      )}

      {/* Team progress bar */}
      {data && totalGoal > 0 && (
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

      {/* Seller table */}
      {data && (
        <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '180px 80px 80px 1fr 100px 100px',
            gap: 16, padding: '12px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}>
            {['Sælger', 'Salg', 'Mål', 'Fremgang', 'Kontakter', 'KR%'].map(h => (
              <div key={h} style={{ fontSize: 11, color: '#667788', fontWeight: 600, letterSpacing: '0.05em' }}>{h}</div>
            ))}
          </div>

          {sellers.length === 0 && (
            <div style={{ padding: '48px', textAlign: 'center', color: '#667788', fontSize: 13 }}>Ingen sælgere endnu</div>
          )}

          {sellers.map((s, i) => {
            const pct = s.unit_goal_month > 0 ? Math.min(100, Math.round(s.sales_month / s.unit_goal_month * 100)) : 0;
            const done = pct >= 100;
            const kr = s.contacts_month > 0 ? (s.sales_month / s.contacts_month * 100) : null;
            return (
              <div key={s.id} style={{
                display: 'grid',
                gridTemplateColumns: '180px 80px 80px 1fr 100px 100px',
                gap: 16, padding: '18px 24px', alignItems: 'center',
                borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#ECF0F1' }}>{s.name}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: done ? '#2ECC71' : '#ECF0F1', fontVariantNumeric: 'tabular-nums' }}>
                  {s.sales_month}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#667788', fontVariantNumeric: 'tabular-nums' }}>
                  {s.unit_goal_month > 0 ? s.unit_goal_month : '—'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4 }}>
                    <div style={{
                      height: '100%', borderRadius: 4, transition: 'width 0.5s',
                      width: s.unit_goal_month > 0 ? `${pct}%` : '0%',
                      background: done ? '#2ECC71' : '#185FA5',
                    }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: done ? '#2ECC71' : '#667788', minWidth: 36, fontVariantNumeric: 'tabular-nums' }}>
                    {s.unit_goal_month > 0 ? `${pct}%` : '—'}
                  </span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#667788', fontVariantNumeric: 'tabular-nums' }}>
                  {s.contacts_month}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: kr !== null ? '#185FA5' : '#334455', fontVariantNumeric: 'tabular-nums' }}>
                  {kr !== null ? `${kr.toFixed(1)}%` : '—'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!data && (
        <div style={{ color: '#667788', fontSize: 14, textAlign: 'center', padding: 60 }}>Indlæser…</div>
      )}
    </div>
  );
}
