'use client';

import { useEffect, useState } from 'react';

interface SellerDay {
  id: string; name: string;
  call_goal: number; sales_goal: number;
  calls_today: number; contacts_today: number; sales_today: number;
}

function Bar({ value, goal, color }: { value: number; goal: number; color: string }) {
  const pct = goal > 0 ? Math.min(100, Math.round(value / goal * 100)) : 0;
  const done = pct >= 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5 }}>
        <div style={{ height: '100%', borderRadius: 5, width: `${pct}%`, background: done ? '#2ECC71' : color, transition: 'width 0.5s' }} />
      </div>
      <span style={{ fontSize: 13, color: done ? '#2ECC71' : '#ECF0F1', width: 70, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
        {value}{goal > 0 ? ` / ${goal}` : ''}
      </span>
    </div>
  );
}

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

  return (
    <div style={{ minHeight: '100vh', background: '#0F1923', padding: '32px 40px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 }}>
        <div>
          <div style={{ fontSize: 13, color: '#185FA5', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>NEXT LEVEL SALES</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#ECF0F1', textTransform: 'capitalize' }}>{dateStr}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 38, fontWeight: 700, color: '#ECF0F1', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>{clock}</div>
          <div style={{ fontSize: 11, color: '#667788', marginTop: 4 }}>Opdateres hvert 30 sek.</div>
        </div>
      </div>

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr 90px 90px', gap: 16, padding: '0 20px', marginBottom: 8 }}>
        {['Sælger', 'Opkald', 'Salg', 'Kontakter', 'Salg i dag'].map(h => (
          <div key={h} style={{ fontSize: 11, color: '#667788', fontWeight: 600, letterSpacing: '0.05em' }}>{h}</div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(data ?? []).map((s, i) => (
          <div key={s.id} style={{
            display: 'grid', gridTemplateColumns: '200px 1fr 1fr 90px 90px',
            gap: 16, alignItems: 'center',
            background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10, padding: '18px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', background: '#185FA5',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#ECF0F1' }}>{s.name}</span>
            </div>
            <Bar value={s.calls_today} goal={s.call_goal} color="#185FA5" />
            <Bar value={s.sales_today} goal={s.sales_goal} color="#0F6E56" />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#667788', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
              {s.contacts_today}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#2ECC71', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
              {s.sales_today}
            </div>
          </div>
        ))}
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
