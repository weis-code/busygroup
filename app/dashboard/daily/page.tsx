'use client';

import { useEffect, useState } from 'react';

const ABSENCE_DK: Record<string, string>    = { VACATION: 'Ferie', SICK: 'Sygdom', OTHER: 'Andet fravær' };
const ABSENCE_COLOR: Record<string, string> = { VACATION: 'var(--bl)', SICK: 'var(--re)', OTHER: 'var(--ye)' };

interface DayData {
  date: string;
  call_goal: number; sales_goal: number;
  calls_today: number; contacts_today: number;
  booked_today: number; held_today: number; sales_today: number;
  is_absent: boolean; absence_type: string | null;
}

function ProgressBar({ label, value, goal, accent }: { label: string; value: number; goal: number; accent: string }) {
  const pct  = goal > 0 ? Math.min(100, Math.round(value / goal * 100)) : 0;
  const done = pct >= 100;
  return (
    <div className="kpi-tile" style={{ '--accent': done ? 'var(--gr)' : accent } as React.CSSProperties}>
      <div className="kpi-label">{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 44, fontWeight: 800, color: done ? 'var(--gr)' : 'var(--t1)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </span>
        {goal > 0 && (
          <>
            <span style={{ fontSize: 18, color: 'var(--t3)', marginBottom: 7, fontVariantNumeric: 'tabular-nums' }}>/ {goal}</span>
            <span style={{ fontSize: 13, color: done ? 'var(--gr)' : 'var(--t3)', marginBottom: 9, marginLeft: 2 }}>{pct}%</span>
          </>
        )}
      </div>
      <div style={{ height: 8, background: 'var(--bd)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 4, transition: 'width 0.5s',
          width: goal > 0 ? `${pct}%` : '0%',
          background: done ? 'var(--gr)' : accent,
        }} />
      </div>
      {goal === 0 && <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 10 }}>Intet mål sat endnu</div>}
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

  if (!data) return <div style={{ padding: 40, color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>;

  const today = new Date().toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });

  if (data.is_absent && data.absence_type) {
    const color = ABSENCE_COLOR[data.absence_type];
    return (
      <div style={{ padding: '28px 32px', maxWidth: 700 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Dagligt mål</h1>
        <p style={{ fontSize: 12, color: 'var(--t3)', textTransform: 'capitalize', marginBottom: 28 }}>{today}</p>
        <div style={{ background: 'var(--s1)', border: `1px solid ${color.replace('var(', '').replace(')', '')}44`, borderRadius: 14, padding: '36px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 36 }}>{data.absence_type === 'VACATION' ? '🌴' : data.absence_type === 'SICK' ? '🤒' : '📅'}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color, letterSpacing: '0.02em' }}>{ABSENCE_DK[data.absence_type]}</div>
          <div style={{ fontSize: 13, color: 'var(--t2)' }}>Du er registreret fraværende i dag — ingen daglige mål.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 700 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Dagligt mål</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gr)', display: 'inline-block' }} />
          <p style={{ fontSize: 12, color: 'var(--t3)', textTransform: 'capitalize' }}>{today} — opdateres hvert 30 sek.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <ProgressBar label="Opkald i dag" value={data.calls_today} goal={data.call_goal} accent="var(--bl)" />
        <ProgressBar label="Salg i dag"   value={data.sales_today} goal={data.sales_goal} accent="var(--gr)" />
      </div>

      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '20px 22px' }}>
        <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 18 }}>Aktivitet i dag</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[
            { label: 'Opkald',    value: data.calls_today },
            { label: 'Kontakter', value: data.contacts_today },
            { label: 'Booket',    value: data.booked_today },
            { label: 'Afholdt',   value: data.held_today },
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--t1)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
