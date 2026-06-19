'use client';

import { useEffect, useState } from 'react';

interface SellerDay {
  id: string; name: string;
  call_goal: number; sales_goal: number;
  calls_today: number; contacts_today: number; sales_today: number;
}
interface SellerMonth {
  id: string; name: string;
  calls_month: number; sales_month: number;
  units_month: number; unit_goal_month: number;
}
interface BoardData { daily: SellerDay[]; monthly: SellerMonth[]; today: string }

type View = 'dag' | 'måned';

function Bar({ value, goal, color }: { value: number; goal: number; color: string }) {
  const pct = goal > 0 ? Math.min(100, Math.round(value / goal * 100)) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5 }}>
        <div style={{ height: '100%', borderRadius: 5, width: `${pct}%`, background: pct >= 100 ? '#2ECC71' : color, transition: 'width 0.5s' }} />
      </div>
      <span style={{ fontSize: 12, color: '#667788', width: 60, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {value}{goal > 0 ? ` / ${goal}` : ''}
      </span>
    </div>
  );
}

export default function BoardPage() {
  const [data, setData] = useState<BoardData | null>(null);
  const [view, setView] = useState<View>('dag');
  const [clock, setClock] = useState('');

  async function load() {
    const d = await fetch('/api/board').then(r => r.json());
    setData(d);
  }

  useEffect(() => {
    load();
    const dataIv = setInterval(load, 30000);
    const clockIv = setInterval(() => {
      setClock(new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => { clearInterval(dataIv); clearInterval(clockIv); };
  }, []);

  const dateStr = data?.today
    ? new Date(data.today).toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  return (
    <div style={{ minHeight: '100vh', background: '#0F1923', padding: '32px 40px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 13, color: '#185FA5', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>NEXT LEVEL SALES</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#ECF0F1', textTransform: 'capitalize' }}>{dateStr}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#ECF0F1', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>{clock}</div>
          <div style={{ fontSize: 11, color: '#667788', marginTop: 4 }}>Opdateres hvert 30 sek.</div>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {(['dag', 'måned'] as View[]).map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: '9px 22px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: view === v ? '#185FA5' : 'rgba(255,255,255,0.06)',
            color: view === v ? '#fff' : '#667788',
            textTransform: 'capitalize',
          }}>{v === 'dag' ? 'I dag' : 'Måned'}</button>
        ))}
      </div>

      {!data && <div style={{ color: '#667788', fontSize: 14 }}>Indlæser…</div>}

      {/* DAG VIEW */}
      {data && view === 'dag' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr 80px 80px', gap: 16, padding: '0 20px', marginBottom: 4 }}>
            {['Sælger', 'Opkald', 'Salg', 'Kontakter', 'Salg i dag'].map(h => (
              <div key={h} style={{ fontSize: 11, color: '#667788', fontWeight: 600, letterSpacing: '0.05em' }}>{h}</div>
            ))}
          </div>
          {data.daily.map((s, i) => (
            <div key={s.id} style={{
              display: 'grid', gridTemplateColumns: '180px 1fr 1fr 80px 80px',
              gap: 16, alignItems: 'center',
              background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10, padding: '18px 20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', background: '#185FA5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#ECF0F1' }}>{s.name}</span>
              </div>
              <Bar value={s.calls_today} goal={s.call_goal} color="#185FA5" />
              <Bar value={s.sales_today} goal={s.sales_goal} color="#0F6E56" />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#667788', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                {s.contacts_today}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#2ECC71', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                {s.sales_today}
              </div>
            </div>
          ))}
          {data.daily.length === 0 && (
            <div style={{ color: '#667788', fontSize: 14, textAlign: 'center', padding: 40 }}>Ingen sælgere endnu</div>
          )}
        </div>
      )}

      {/* MÅNED VIEW */}
      {data && view === 'måned' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 80px 80px', gap: 16, padding: '0 20px', marginBottom: 4 }}>
            {['Sælger', 'Salg mod mål', 'Opkald', 'Salg'].map(h => (
              <div key={h} style={{ fontSize: 11, color: '#667788', fontWeight: 600, letterSpacing: '0.05em' }}>{h}</div>
            ))}
          </div>
          {data.monthly.map((s, i) => (
            <div key={s.id} style={{
              display: 'grid', gridTemplateColumns: '180px 1fr 80px 80px',
              gap: 16, alignItems: 'center',
              background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10, padding: '18px 20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', background: '#185FA5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#ECF0F1' }}>{s.name}</span>
              </div>
              <Bar value={s.units_month} goal={s.unit_goal_month} color="#185FA5" />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#667788', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                {s.calls_month}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#2ECC71', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                {s.sales_month}
              </div>
            </div>
          ))}
          {data.monthly.length === 0 && (
            <div style={{ color: '#667788', fontSize: 14, textAlign: 'center', padding: 40 }}>Ingen sælgere endnu</div>
          )}
        </div>
      )}
    </div>
  );
}
