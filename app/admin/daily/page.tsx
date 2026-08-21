'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

const ABSENCE_DK: Record<string, string>    = { VACATION: 'Ferie', SICK: 'Sygdom', OTHER: 'Andet fravær' };
const ABSENCE_CLR: Record<string, string>   = { VACATION: 'var(--bl)', SICK: 'var(--re)', OTHER: 'var(--ye)' };
const ABSENCE_BG: Record<string, string>    = { VACATION: 'var(--bl2)', SICK: 'var(--re2)', OTHER: 'var(--ye2)' };

interface SellerRow {
  id: string; name: string; role: string;
  call_goal: number; sales_goal: number;
  calls_actual: number; contacts_actual: number;
  meetings_booked_actual: number; meetings_held_actual: number;
  sales_today: number;
  absence_type: string | null;
}

function StatusBar({ value, goal, accent }: { value: number; goal: number; accent: string }) {
  const pct  = goal > 0 ? Math.min(100, Math.round(value / goal * 100)) : 0;
  const done = pct >= 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--bd)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: done ? 'var(--gr)' : accent, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 11, color: done ? 'var(--gr)' : 'var(--t3)', minWidth: 34, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
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
      style={{ width: 70, padding: '6px 10px', borderRadius: 6, textAlign: 'center', background: 'var(--s2)', border: '1px solid var(--bd2)', color: 'var(--t1)', fontSize: 14, fontWeight: 600 }}
    />
  );
}

function SmallNumInput({ label, value, onSave }: { label: string; value: number; onSave: (v: number) => void }) {
  const [local, setLocal] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setLocal(String(value)); }, [value]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <div style={{ fontSize: 10, color: 'var(--t3)', letterSpacing: '0.06em', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
      <input
        ref={ref} type="number" min="0" value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => { const n = parseInt(local); if (!isNaN(n) && n !== value) onSave(n); }}
        onKeyDown={e => { if (e.key === 'Enter') ref.current?.blur(); }}
        style={{ width: 70, padding: '7px 10px', borderRadius: 6, textAlign: 'center', background: 'var(--s2)', border: '1px solid var(--bd2)', color: 'var(--t1)', fontSize: 15, fontWeight: 700 }}
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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId, date, call_goal: updated.call_goal, sales_goal: updated.sales_goal,
        calls_actual: updated.calls_actual, contacts_actual: updated.contacts_actual,
        meetings_booked_actual: updated.meetings_booked_actual, meetings_held_actual: updated.meetings_held_actual,
        // Non-sellers (e.g. an opted-in admin) type their own sales count in — sellers' is derived live from real sales, so don't overwrite it
        ...(updated.role !== 'SELLER' ? { sales_actual: updated.sales_today } : {}),
      }),
    });
  }

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Daglige mål</h1>
          <p className="page-sub" style={{ textTransform: 'capitalize' }}>{dateLabel}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isToday && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--t3)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gr)', display: 'inline-block' }} />
              Live — 30 sek.
            </div>
          )}
          {!isToday && (
            <button onClick={() => setDate(new Date().toISOString().slice(0, 10))} className="btn btn-ghost btn-sm">I dag</button>
          )}
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 150 }} />
        </div>
      </div>

      {rows.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--t3)', fontSize: 13, padding: 40 }}>Ingen sælgere</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map(row => (
          <div key={row.id} style={{
            background: 'var(--s1)',
            border: row.absence_type ? `1px solid ${ABSENCE_BG[row.absence_type]}` : '1px solid var(--bd)',
            borderRadius: 12, padding: '20px 24px',
            opacity: row.absence_type ? 0.6 : 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{row.name}</span>
              {row.absence_type && (
                <span style={{ fontSize: 10, fontWeight: 700, color: ABSENCE_CLR[row.absence_type], background: ABSENCE_BG[row.absence_type], borderRadius: 4, padding: '2px 8px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {ABSENCE_DK[row.absence_type]}
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '90px 90px 90px 1fr', gap: 10, alignItems: 'center', marginBottom: 16 }}>
              <div />
              <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700, letterSpacing: '0.06em', textAlign: 'center', textTransform: 'uppercase' }}>Mål</div>
              <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700, letterSpacing: '0.06em', textAlign: 'center', textTransform: 'uppercase' }}>Faktisk</div>
              <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Status</div>

              <div style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 500 }}>Opkald</div>
              <div style={{ display: 'flex', justifyContent: 'center' }}><NumInput value={row.call_goal} onSave={v => save(row.id, 'call_goal', v)} /></div>
              <div style={{ display: 'flex', justifyContent: 'center' }}><NumInput value={row.calls_actual} onSave={v => save(row.id, 'calls_actual', v)} /></div>
              <StatusBar value={row.calls_actual} goal={row.call_goal} accent="var(--bl)" />

              <div style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 500 }}>Salg</div>
              <div style={{ display: 'flex', justifyContent: 'center' }}><NumInput value={row.sales_goal} onSave={v => save(row.id, 'sales_goal', v)} /></div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {row.role === 'SELLER' ? (
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--gr)', fontVariantNumeric: 'tabular-nums' }}>{row.sales_today}</span>
                ) : (
                  <NumInput value={row.sales_today} onSave={v => save(row.id, 'sales_today', v)} />
                )}
              </div>
              <StatusBar value={row.sales_today} goal={row.sales_goal} accent="var(--gr)" />
            </div>

            <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 16, display: 'flex', gap: 24, alignItems: 'flex-end' }}>
              <SmallNumInput label="Kontakter" value={row.contacts_actual} onSave={v => save(row.id, 'contacts_actual', v)} />
              {row.contacts_actual > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <div style={{ fontSize: 10, color: 'var(--t3)', letterSpacing: '0.06em', fontWeight: 600, textTransform: 'uppercase' }}>Konv. rate</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--bl)', fontVariantNumeric: 'tabular-nums', padding: '7px 14px', background: 'var(--bl3)', borderRadius: 6 }}>
                    {(row.sales_today / row.contacts_actual * 100).toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 14, fontSize: 11, color: 'var(--t4)' }}>
        Klik på et tal og tryk Enter eller klik væk for at gemme.
      </p>
    </div>
  );
}
