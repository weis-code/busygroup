'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

interface SellerRow {
  id: string; name: string;
  call_goal: number; sales_goal: number;
  calls_today: number; contacts_today: number; sales_today: number;
}

function MiniBar({ value, goal, color }: { value: number; goal: number; color: string }) {
  const pct = goal > 0 ? Math.min(100, Math.round(value / goal * 100)) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, minWidth: 80 }}>
        <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: pct >= 100 ? '#2ECC71' : color, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 12, color: pct >= 100 ? '#2ECC71' : '#ECF0F1', fontVariantNumeric: 'tabular-nums', fontWeight: 600, minWidth: 48 }}>
        {value} / {goal}
      </span>
      <span style={{ fontSize: 11, color: '#667788', minWidth: 34 }}>{goal > 0 ? pct + '%' : '—'}</span>
    </div>
  );
}

function GoalInput({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [local, setLocal] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocal(String(value)); }, [value]);

  return (
    <input
      ref={ref}
      type="number" min="0" value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { const n = parseInt(local); if (!isNaN(n) && n !== value) onSave(n); }}
      onKeyDown={e => { if (e.key === 'Enter') ref.current?.blur(); }}
      style={{
        width: 70, padding: '6px 10px', borderRadius: 6, textAlign: 'center',
        background: '#0F1923', border: '1px solid rgba(255,255,255,0.12)',
        color: '#ECF0F1', fontSize: 14, fontWeight: 600,
      }}
    />
  );
}

export default function AdminDailyPage() {
  const [rows, setRows] = useState<SellerRow[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState<string | null>(null);
  const isToday = date === new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    const d = await fetch(`/api/admin/daily-targets?date=${date}`).then(r => r.json());
    setRows(d.rows || []);
  }, [date]);

  useEffect(() => {
    load();
    if (!isToday) return;
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load, isToday]);

  async function saveGoal(userId: string, field: 'call_goal' | 'sales_goal', value: number) {
    setSaving(userId + field);
    const row = rows.find(r => r.id === userId)!;
    await fetch('/api/admin/daily-targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId, date,
        call_goal: field === 'call_goal' ? value : row.call_goal,
        sales_goal: field === 'sales_goal' ? value : row.sales_goal,
      }),
    });
    setRows(prev => prev.map(r => r.id === userId ? { ...r, [field]: value } : r));
    setSaving(null);
  }

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 4 }}>Daglige mål</h1>
          <p style={{ fontSize: 13, color: '#667788', textTransform: 'capitalize' }}>{dateLabel}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {!isToday && (
            <button onClick={() => setDate(new Date().toISOString().slice(0, 10))}
              style={{ background: 'rgba(255,255,255,0.06)', color: '#667788', padding: '8px 14px', borderRadius: 7, fontSize: 12 }}>
              I dag
            </button>
          )}
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ width: 150, padding: '8px 12px', fontSize: 13 }} />
        </div>
      </div>

      {isToday && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, fontSize: 12, color: '#667788' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2ECC71', display: 'inline-block', animation: 'pulse-dot 2s infinite' }} />
          Opdateres automatisk hvert 30 sek.
        </div>
      )}

      <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '160px 90px 90px 1fr 1fr 60px 60px',
          gap: 16, padding: '12px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          {['Sælger', 'Opkaldsmål', 'Salgsmål', 'Opkald fremgang', 'Salg fremgang', 'Kontakter', 'Salg'].map(h => (
            <div key={h} style={{ fontSize: 11, color: '#667788', fontWeight: 500 }}>{h}</div>
          ))}
        </div>

        {rows.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#667788', fontSize: 13 }}>Ingen sælgere</div>
        )}

        {rows.map((row, i) => (
          <div key={row.id} style={{
            display: 'grid',
            gridTemplateColumns: '160px 90px 90px 1fr 1fr 60px 60px',
            gap: 16, padding: '16px 20px', alignItems: 'center',
            borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined,
            background: saving?.startsWith(row.id) ? 'rgba(24,95,165,0.05)' : 'transparent',
            transition: 'background 0.2s',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#ECF0F1' }}>{row.name}</div>

            <GoalInput value={row.call_goal} onSave={v => saveGoal(row.id, 'call_goal', v)} />
            <GoalInput value={row.sales_goal} onSave={v => saveGoal(row.id, 'sales_goal', v)} />

            <MiniBar value={row.calls_today} goal={row.call_goal} color="#185FA5" />
            <MiniBar value={row.sales_today} goal={row.sales_goal} color="#0F6E56" />

            <div style={{ fontSize: 14, fontWeight: 600, color: '#667788', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
              {row.contacts_today}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#2ECC71', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
              {row.sales_today}
            </div>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 14, fontSize: 12, color: '#667788' }}>
        Klik på et tal og tryk Enter eller klik væk for at gemme.
      </p>
    </div>
  );
}
