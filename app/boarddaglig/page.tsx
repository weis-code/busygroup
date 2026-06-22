'use client';

import { useEffect, useState } from 'react';

interface SellerDay {
  id: string; name: string;
  call_goal: number; sales_goal: number;
  calls_today: number; contacts_today: number; sales_today: number;
}

function Bar({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const pct = goal > 0 ? Math.min(100, Math.round(value / goal * 100)) : 0;
  const done = pct >= 100;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: '#667788', fontWeight: 700, letterSpacing: '0.08em' }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: done ? '#2ECC71' : '#ECF0F1', fontVariantNumeric: 'tabular-nums' }}>
          {value}{goal > 0 ? <span style={{ fontSize: 12, color: '#667788', fontWeight: 500 }}> / {goal}</span> : ''}
          {goal > 0 && <span style={{ fontSize: 12, color: done ? '#2ECC71' : '#185FA5', fontWeight: 700, marginLeft: 6 }}>{pct}%</span>}
        </span>
      </div>
      <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4 }}>
        <div style={{ height: '100%', borderRadius: 4, width: goal > 0 ? `${pct}%` : '0%', background: done ? '#2ECC71' : color, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function BoardDagligPage() {
  const [data, setData] = useState<SellerDay[] | null>(null);
  const [today, setToday] = useState('');
  const [clock, setClock] = useState('');

  async function load() {
    const d = await fetch('/api/board').then(r => r.json());
    setData(d.daily);
    setToday(d.today);
  }

  useEffect(() => {
    load();
    const dataIv = setInterval(load, 30000);
    const clockIv = setInterval(() => {
      setClock(new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => { clearInterval(dataIv); clearInterval(clockIv); };
  }, []);

  const dateStr = today
    ? new Date(today).toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  const sellers = data ?? [];

  return (
    <div style={{ minHeight: '100vh', background: '#0F1923', padding: '32px 40px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 13, color: '#185FA5', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>NEXT LEVEL SALES</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#ECF0F1', textTransform: 'capitalize' }}>{dateStr}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 38, fontWeight: 700, color: '#ECF0F1', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>{clock}</div>
          <div style={{ fontSize: 11, color: '#667788', marginTop: 4 }}>Opdateres hvert 30 sek.</div>
        </div>
      </div>

      {/* 2-column seller grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {sellers.map((s, i) => (
          <div key={s.id} style={{
            background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12, padding: '20px 24px',
          }}>
            {/* Name row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: '#185FA5',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: i < 3 ? 18 : 13, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {i < 3 ? MEDALS[i] : i + 1}
              </div>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#ECF0F1' }}>{s.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 22, fontWeight: 800, color: s.sales_today > 0 ? '#2ECC71' : '#334455', fontVariantNumeric: 'tabular-nums' }}>
                {s.sales_today} salg
              </span>
            </div>

            {/* Bars */}
            <Bar label="OPKALD" value={s.calls_today} goal={s.call_goal} color="#185FA5" />
            <Bar label="SALG" value={s.sales_today} goal={s.sales_goal} color="#0F6E56" />

            {/* Footer stats */}
            <div style={{ display: 'flex', gap: 20, marginTop: 6, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <div style={{ fontSize: 10, color: '#667788', letterSpacing: '0.06em', marginBottom: 2 }}>KONTAKTER</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#ECF0F1', fontVariantNumeric: 'tabular-nums' }}>{s.contacts_today}</div>
              </div>
              {s.contacts_today > 0 && s.sales_today > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: '#667788', letterSpacing: '0.06em', marginBottom: 2 }}>KR%</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#185FA5', fontVariantNumeric: 'tabular-nums' }}>
                    {(s.sales_today / s.contacts_today * 100).toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {data?.length === 0 && (
          <div style={{ gridColumn: '1 / -1', color: '#667788', fontSize: 14, textAlign: 'center', padding: 60 }}>Ingen sælgere endnu</div>
        )}
        {!data && (
          <div style={{ gridColumn: '1 / -1', color: '#667788', fontSize: 14, textAlign: 'center', padding: 60 }}>Indlæser…</div>
        )}
      </div>
    </div>
  );
}
