'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

interface SellerRow {
  id: string; name: string;
  call_goal: number; sales_goal: number;
  calls_actual: number; contacts_actual: number;
  meetings_booked_actual: number; meetings_held_actual: number; // kept in DB, not shown
  sales_today: number;
}

function StatusBar({ value, goal, color }: { value: number; goal: number; color: string }) {
  const pct = goal > 0 ? Math.min(100, Math.round(value / goal * 100)) : 0;
  const done = pct >= 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 7, background: 'rgba(255,255,255,0.08)', borderRadius: 4 }}>
        <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: done ? '#2ECC71' : color, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 12, color: done ? '#2ECC71' : '#667788', minWidth: 36, fontVariantNumeric: 'tabular-nums' }}>
        {goal > 0 ? pct + '%' : '—'}
      </span>
    </div>
  );
}

function NumInput({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [local, setLocal] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setLocal(String(value)); }, [value]);
  return (
    <input
      ref={ref} type="number" min="0" value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { const n = parseInt(local); if (!isNaN(n) && n !== value) onSave(n); }}
      onKeyDown={e => { if (e.key === 'Enter') ref.current?.blur(); }}
      style={{
        width: 72, padding: '6px 10px', borderRadius: 6, textAlign: 'center',
        background: '#0F1923', border: '1px solid rgba(255,255,255,0.12)',
        color: '#ECF0F1', fontSize: 14, fontWeight: 600,
      }}
    />
  );
}

function SmallNumInput({ label, value, onSave }: { label: string; value: number; onSave: (v: number) => void }) {
  const [local, setLocal] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setLocal(String(value)); }, [value]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <div style={{ fontSize: 11, color: '#667788', letterSpacing: '0.04em' }}>{label}</div>
      <input
        ref={ref} type="number" min="0" value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => { const n = parseInt(local); if (!isNaN(n) && n !== value) onSave(n); }}
        onKeyDown={e => { if (e.key === 'Enter') ref.current?.blur(); }}
        style={{
          width: 72, padding: '7px 10px', borderRadius: 6, textAlign: 'center',
          background: '#0F1923', border: '1px solid rgba(255,255,255,0.12)',
          color: '#ECF0F1', fontSize: 15, fontWeight: 700,
        }}
      />
    </div>
  );
}

export default function AdminDailyPage() {
  const [rows, setRows] = useState<SellerRow[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
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

  async function save(userId: string, field: keyof SellerRow, value: number) {
    const row = rows.find(r => r.id === userId)!;
    const updated = { ...row, [field]: value };
    setRows(prev => prev.map(r => r.id === userId ? updated : r));
    await fetch('/api/admin/daily-targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId, date,
        call_goal: updated.call_goal,
        sales_goal: updated.sales_goal,
        calls_actual: updated.calls_actual,
        contacts_actual: updated.contacts_actual,
        meetings_booked_actual: updated.meetings_booked_actual,
        meetings_held_actual: updated.meetings_held_actual,
      }),
    });
  }

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 4 }}>Daglige mål</h1>
          <p style={{ fontSize: 13, color: '#667788', textTransform: 'capitalize' }}>{dateLabel}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isToday && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#667788' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2ECC71', display: 'inline-block', animation: 'pulse-dot 2s infinite' }} />
              Live — 30 sek.
            </div>
          )}
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

      {rows.length === 0 && (
        <div style={{ textAlign: 'center', color: '#667788', fontSize: 13, padding: 40 }}>Ingen sælgere</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {rows.map(row => (
          <div key={row.id} style={{
            background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12, padding: '20px 24px',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#ECF0F1', marginBottom: 18 }}>{row.name}</div>

            {/* Goal / Actual / Status table */}
            <div style={{ display: 'grid', gridTemplateColumns: '90px 90px 90px 1fr', gap: 10, alignItems: 'center', marginBottom: 18 }}>
              {/* Headers */}
              <div style={{ fontSize: 11, color: '#667788', fontWeight: 600, letterSpacing: '0.05em' }}></div>
              <div style={{ fontSize: 11, color: '#667788', fontWeight: 600, letterSpacing: '0.05em', textAlign: 'center' }}>MÅL</div>
              <div style={{ fontSize: 11, color: '#667788', fontWeight: 600, letterSpacing: '0.05em', textAlign: 'center' }}>FAKTISK</div>
              <div style={{ fontSize: 11, color: '#667788', fontWeight: 600, letterSpacing: '0.05em' }}>STATUS</div>

              {/* Opkald row */}
              <div style={{ fontSize: 13, color: '#A0AEC0', fontWeight: 500 }}>Opkald</div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <NumInput value={row.call_goal} onSave={v => save(row.id, 'call_goal', v)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <NumInput value={row.calls_actual} onSave={v => save(row.id, 'calls_actual', v)} />
              </div>
              <StatusBar value={row.calls_actual} goal={row.call_goal} color="#185FA5" />

              {/* Salg row */}
              <div style={{ fontSize: 13, color: '#A0AEC0', fontWeight: 500 }}>Salg</div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <NumInput value={row.sales_goal} onSave={v => save(row.id, 'sales_goal', v)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#2ECC71', fontVariantNumeric: 'tabular-nums' }}>
                  {row.sales_today}
                </span>
              </div>
              <StatusBar value={row.sales_today} goal={row.sales_goal} color="#0F6E56" />
            </div>

            {/* Activity metrics */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16, display: 'flex', gap: 24, alignItems: 'flex-end' }}>
              <SmallNumInput label="KONTAKTER" value={row.contacts_actual} onSave={v => save(row.id, 'contacts_actual', v)} />
              {row.contacts_actual > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div style={{ fontSize: 11, color: '#667788', letterSpacing: '0.04em' }}>KONV. RATE</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#185FA5', fontVariantNumeric: 'tabular-nums', padding: '7px 14px', background: 'rgba(24,95,165,0.1)', borderRadius: 6 }}>
                    {(row.sales_today / row.contacts_actual * 100).toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 16, fontSize: 12, color: '#667788' }}>
        Klik på et tal og tryk Enter eller klik væk for at gemme.
      </p>
    </div>
  );
}
