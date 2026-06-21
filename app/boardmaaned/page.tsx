'use client';

import { useEffect, useState } from 'react';

interface SellerMonth {
  id: string; name: string;
  sales_month: number; units_month: number; unit_goal_month: number;
  contacts_month: number;
}

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
  const sellers = data ?? [];

  const totalSales = sellers.reduce((s, r) => s + r.sales_month, 0);
  const totalGoal = sellers.reduce((s, r) => s + r.unit_goal_month, 0);
  const totalContacts = sellers.reduce((s, r) => s + r.contacts_month, 0);
  const totalPct = totalGoal > 0 ? Math.min(100, Math.round(totalSales / totalGoal * 100)) : 0;
  const teamKR = totalContacts > 0 ? (totalSales / totalContacts * 100) : null;

  return (
    <div style={{ minHeight: '100vh', background: '#0F1923', padding: '32px 48px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 12, color: '#185FA5', fontWeight: 700, letterSpacing: '0.12em', marginBottom: 6 }}>NEXT LEVEL SALES</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#ECF0F1', textTransform: 'capitalize' }}>{monthName}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#ECF0F1', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>{clock}</div>
          <div style={{ fontSize: 11, color: '#667788', marginTop: 4 }}>Opdateres hvert 30 sek.</div>
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
          {/* Table header */}
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
                {/* Name */}
                <div style={{ fontSize: 14, fontWeight: 700, color: '#ECF0F1' }}>{s.name}</div>

                {/* Sales */}
                <div style={{ fontSize: 22, fontWeight: 800, color: done ? '#2ECC71' : '#ECF0F1', fontVariantNumeric: 'tabular-nums' }}>
                  {s.sales_month}
                </div>

                {/* Goal */}
                <div style={{ fontSize: 14, fontWeight: 600, color: '#667788', fontVariantNumeric: 'tabular-nums' }}>
                  {s.unit_goal_month > 0 ? s.unit_goal_month : '—'}
                </div>

                {/* Progress bar */}
                <div>
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
                </div>

                {/* Contacts */}
                <div style={{ fontSize: 14, fontWeight: 600, color: '#667788', fontVariantNumeric: 'tabular-nums' }}>
                  {s.contacts_month}
                </div>

                {/* Conversion rate */}
                <div style={{
                  fontSize: 15, fontWeight: 700,
                  color: kr !== null ? '#185FA5' : '#334455',
                  fontVariantNumeric: 'tabular-nums',
                }}>
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
