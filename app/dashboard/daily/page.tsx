'use client';

import { useEffect, useState, FormEvent } from 'react';

interface DayData {
  date: string;
  call_goal: number; sales_goal: number;
  calls_today: number; contacts_today: number;
  booked_today: number; held_today: number; sales_today: number;
}

function ProgressBar({ value, goal, color = '#185FA5' }: { value: number; goal: number; color?: string }) {
  const pct = goal > 0 ? Math.min(100, Math.round(value / goal * 100)) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
        <span style={{ color: '#ECF0F1', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{value}</span>
        <span style={{ color: '#667788' }}>mål: {goal} ({pct}%)</span>
      </div>
      <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4 }}>
        <div style={{
          height: '100%', borderRadius: 4, transition: 'width 0.4s',
          width: `${pct}%`,
          background: pct >= 100 ? '#2ECC71' : color,
        }} />
      </div>
    </div>
  );
}

export default function DailyPage() {
  const [data, setData] = useState<DayData | null>(null);
  const [editing, setEditing] = useState(false);
  const [callGoal, setCallGoal] = useState('');
  const [salesGoal, setSalesGoal] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const d = await fetch('/api/daily-targets').then(r => r.json());
    setData(d);
    setCallGoal(String(d.call_goal));
    setSalesGoal(String(d.sales_goal));
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch('/api/daily-targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ call_goal: Number(callGoal), sales_goal: Number(salesGoal) }),
    });
    setSaving(false);
    setEditing(false);
    load();
  }

  if (!data) return <div style={{ padding: 40, color: '#667788', fontSize: 13 }}>Indlæser…</div>;

  const today = new Date().toLocaleDateString('da-DK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div style={{ padding: '28px 32px', maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 4 }}>Dagligt mål</h1>
          <p style={{ fontSize: 13, color: '#667788', textTransform: 'capitalize' }}>{today}</p>
        </div>
        <button onClick={() => setEditing(true)} style={{
          background: '#185FA5', color: '#fff', padding: '10px 18px',
          borderRadius: 8, fontWeight: 600, fontSize: 13,
        }}>
          {data.call_goal === 0 && data.sales_goal === 0 ? 'Sæt mål' : 'Opdater mål'}
        </button>
      </div>

      {/* Progress cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '22px 24px' }}>
          <div style={{ fontSize: 11, color: '#667788', letterSpacing: '0.06em', marginBottom: 16 }}>OPKALD I DAG</div>
          <ProgressBar value={data.calls_today} goal={data.call_goal} color="#185FA5" />
        </div>
        <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '22px 24px' }}>
          <div style={{ fontSize: 11, color: '#667788', letterSpacing: '0.06em', marginBottom: 16 }}>SALG I DAG</div>
          <ProgressBar value={data.sales_today} goal={data.sales_goal} color="#0F6E56" />
        </div>
      </div>

      {/* Extra stats */}
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
              <div style={{ fontSize: 28, fontWeight: 700, color: '#ECF0F1', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
              <div style={{ fontSize: 11, color: '#667788', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1A2A38', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 28, width: 380 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#ECF0F1', marginBottom: 22 }}>Sæt dagens mål</div>
            <form onSubmit={onSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label>Opkaldsmål</label>
                <input type="number" min="0" value={callGoal} onChange={e => setCallGoal(e.target.value)} placeholder="100" autoFocus />
              </div>
              <div>
                <label>Salgsmål</label>
                <input type="number" min="0" value={salesGoal} onChange={e => setSalesGoal(e.target.value)} placeholder="3" />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setEditing(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 7, background: 'rgba(255,255,255,0.06)', color: '#667788' }}>Annuller</button>
                <button type="submit" disabled={saving} style={{ flex: 2, padding: '10px 0', borderRadius: 7, background: '#185FA5', color: '#fff', fontWeight: 600 }}>
                  {saving ? 'Gemmer…' : 'Gem mål'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
