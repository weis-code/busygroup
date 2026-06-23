'use client';

import { useEffect, useState } from 'react';

const ABSENCE_DK: Record<string, string> = { VACATION: 'Ferie', SICK: 'Sygdom', OTHER: 'Andet fravær' };
const ABSENCE_COLOR: Record<string, string> = { VACATION: '#185FA5', SICK: '#E74C3C', OTHER: '#F39C12' };

interface DayData {
  date: string;
  call_goal: number; sales_goal: number;
  calls_today: number; contacts_today: number;
  booked_today: number; held_today: number; sales_today: number;
  is_absent: boolean; absence_type: string | null;
}

function ProgressBar({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const pct = goal > 0 ? Math.min(100, Math.round(value / goal * 100)) : 0;
  const done = pct >= 100;
  return (
    <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '22px 24px' }}>
      <div style={{ fontSize: 11, color: '#667788', letterSpacing: '0.06em', marginBottom: 14 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 14 }}>
        <span style={{ fontSize: 44, fontWeight: 800, color: done ? '#2ECC71' : '#ECF0F1', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </span>
        {goal > 0 && (
          <span style={{ fontSize: 18, color: '#667788', marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>
            / {goal}
          </span>
        )}
        {goal > 0 && (
          <span style={{ fontSize: 14, color: done ? '#2ECC71' : '#667788', marginBottom: 8, marginLeft: 4 }}>
            {pct}%
          </span>
        )}
      </div>
      <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5 }}>
        <div style={{
          height: '100%', borderRadius: 5, transition: 'width 0.5s',
          width: goal > 0 ? `${pct}%` : '0%',
          background: done ? '#2ECC71' : color,
        }} />
      </div>
      {goal === 0 && <div style={{ fontSize: 12, color: '#667788', marginTop: 10 }}>Intet mål sat endnu</div>}
    </div>
  );
}

export default function DailyPage() {
  const [data, setData] = useState<DayData | null>(null);

  useEffect(() => {
    const load = () => fetch('/api/daily-targets').then(r => r.json()).then(setData);
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  if (!data) return <div style={{ padding: 40, color: '#667788', fontSize: 13 }}>Indlæser…</div>;

  const today = new Date().toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });

  if (data.is_absent && data.absence_type) {
    const color = ABSENCE_COLOR[data.absence_type];
    return (
      <div style={{ padding: '28px 32px', maxWidth: 700 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 4 }}>Dagligt mål</h1>
        <p style={{ fontSize: 13, color: '#667788', textTransform: 'capitalize', marginBottom: 28 }}>{today}</p>
        <div style={{ background: '#111E2A', border: `1px solid ${color}44`, borderRadius: 10, padding: '32px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 32 }}>{data.absence_type === 'VACATION' ? '🌴' : data.absence_type === 'SICK' ? '🤒' : '📅'}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color, letterSpacing: '0.04em' }}>{ABSENCE_DK[data.absence_type]}</div>
          <div style={{ fontSize: 13, color: '#667788' }}>Du er registreret fraværende i dag — ingen daglige mål.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 700 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 4 }}>Dagligt mål</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2ECC71', display: 'inline-block', animation: 'pulse-dot 2s infinite' }} />
          <p style={{ fontSize: 13, color: '#667788', textTransform: 'capitalize' }}>{today} — opdateres hvert 30 sek.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <ProgressBar label="OPKALD I DAG" value={data.calls_today} goal={data.call_goal} color="#185FA5" />
        <ProgressBar label="SALG I DAG" value={data.sales_today} goal={data.sales_goal} color="#0F6E56" />
      </div>

      <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '22px 24px' }}>
        <div style={{ fontSize: 11, color: '#667788', letterSpacing: '0.06em', marginBottom: 18 }}>AKTIVITET I DAG</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[
            { label: 'Opkald', value: data.calls_today },
            { label: 'Kontakter', value: data.contacts_today },
            { label: 'Booket', value: data.booked_today },
            { label: 'Afholdt', value: data.held_today },
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#ECF0F1', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
              <div style={{ fontSize: 11, color: '#667788', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
