'use client';

import { useEffect, useState } from 'react';

interface SellerMonth {
  id: string; name: string;
  sales_month: number; units_month: number; unit_goal_month: number;
}

export default function BoardMaanedPage() {
  const [data, setData] = useState<SellerMonth[] | null>(null);
  const [clock, setClock] = useState('');

  async function load() {
    const d = await fetch('/api/board').then(r => r.json());
    setData(d.monthly);
  }

  useEffect(() => {
    load();
    const dataIv = setInterval(load, 30000);
    const clockIv = setInterval(() => {
      setClock(new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => { clearInterval(dataIv); clearInterval(clockIv); };
  }, []);

  const monthName = new Date().toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });

  const totalSales = (data ?? []).reduce((s, r) => s + r.sales_month, 0);
  const totalGoal = (data ?? []).reduce((s, r) => s + r.unit_goal_month, 0);
  const totalPct = totalGoal > 0 ? Math.min(100, Math.round(totalSales / totalGoal * 100)) : 0;

  return (
    <div style={{ minHeight: '100vh', background: '#0F1923', padding: '32px 40px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 }}>
        <div>
          <div style={{ fontSize: 13, color: '#185FA5', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>NEXT LEVEL SALES</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#ECF0F1', textTransform: 'capitalize' }}>{monthName}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 38, fontWeight: 700, color: '#ECF0F1', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>{clock}</div>
          <div style={{ fontSize: 11, color: '#667788', marginTop: 4 }}>Opdateres hvert 30 sek.</div>
        </div>
      </div>

      {/* Summary bar */}
      {data && (
        <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '20px 28px', marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: '#667788', fontWeight: 600, letterSpacing: '0.06em' }}>SAMLET FREMGANG</div>
            <div style={{ display: 'flex', gap: 24, alignItems: 'baseline' }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: totalPct >= 100 ? '#2ECC71' : '#ECF0F1', fontVariantNumeric: 'tabular-nums' }}>{totalSales}</span>
              {totalGoal > 0 && (
                <>
                  <span style={{ fontSize: 16, color: '#667788', fontVariantNumeric: 'tabular-nums' }}>/ {totalGoal} mål</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: totalPct >= 100 ? '#2ECC71' : '#185FA5', fontVariantNumeric: 'tabular-nums' }}>{totalPct}%</span>
                </>
              )}
            </div>
          </div>
          <div style={{ height: 12, background: 'rgba(255,255,255,0.08)', borderRadius: 6 }}>
            <div style={{
              height: '100%', borderRadius: 6, transition: 'width 0.5s',
              width: totalGoal > 0 ? `${totalPct}%` : '0%',
              background: totalPct >= 100 ? '#2ECC71' : '#185FA5',
            }} />
          </div>
        </div>
      )}

      {/* Seller rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(data ?? []).map((s, i) => {
          const pct = s.unit_goal_month > 0 ? Math.min(100, Math.round(s.sales_month / s.unit_goal_month * 100)) : 0;
          const done = pct >= 100;
          return (
            <div key={s.id} style={{
              background: '#111E2A', border: `1px solid ${done ? 'rgba(46,204,113,0.25)' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 12, padding: '22px 24px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: done ? 'rgba(46,204,113,0.2)' : '#185FA5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </div>
                <span style={{ fontSize: 17, fontWeight: 700, color: '#ECF0F1', flex: 1 }}>{s.name}</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: done ? '#2ECC71' : '#ECF0F1', fontVariantNumeric: 'tabular-nums' }}>{s.sales_month}</span>
                  {s.unit_goal_month > 0 && (
                    <span style={{ fontSize: 14, color: '#667788', fontVariantNumeric: 'tabular-nums' }}>/ {s.unit_goal_month}</span>
                  )}
                  {s.unit_goal_month > 0 && (
                    <span style={{ fontSize: 16, fontWeight: 700, color: done ? '#2ECC71' : '#667788', minWidth: 48, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                  )}
                </div>
              </div>
              <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5 }}>
                <div style={{
                  height: '100%', borderRadius: 5, transition: 'width 0.5s',
                  width: s.unit_goal_month > 0 ? `${pct}%` : '0%',
                  background: done ? '#2ECC71' : '#185FA5',
                }} />
              </div>
              {s.unit_goal_month === 0 && (
                <div style={{ fontSize: 12, color: '#667788', marginTop: 8 }}>Intet månedsmål sat</div>
              )}
            </div>
          );
        })}
        {data?.length === 0 && (
          <div style={{ color: '#667788', fontSize: 14, textAlign: 'center', padding: 60 }}>Ingen sælgere endnu</div>
        )}
        {!data && (
          <div style={{ color: '#667788', fontSize: 14, textAlign: 'center', padding: 60 }}>Indlæser…</div>
        )}
      </div>
    </div>
  );
}
