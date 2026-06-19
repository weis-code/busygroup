'use client';

import { useEffect, useState } from 'react';

type Filter = 'active_period' | 'this_week' | 'this_month' | 'custom';

interface Row {
  id: string; name: string; activity_score: number; total_calls: number;
  total_booked: number; total_held: number; total_sales: number; total_units: number; task_count: number;
}

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'active_period', label: 'Aktiv lønperiode' },
  { value: 'this_week', label: 'Denne uge' },
  { value: 'this_month', label: 'Denne måned' },
  { value: 'custom', label: 'Tilpasset' },
];

const MEDAL: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };

export default function LeaderboardPage() {
  const [filter, setFilter] = useState<Filter>('active_period');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [data, setData] = useState<{ rows: Row[]; startDate: string; endDate: string } | null>(null);
  const [me, setMe] = useState<{ id: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(setMe);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ filter });
    if (filter === 'custom' && customStart && customEnd) {
      params.set('start', customStart);
      params.set('end', customEnd);
    }
    fetch('/api/leaderboard?' + params).then(r => r.json()).then(setData);
  }, [filter, customStart, customEnd]);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 6 }}>Leaderboard</h1>
      <p style={{ fontSize: 13, color: '#667788', marginBottom: 24 }}>Rangeret efter activity score</p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)} style={{
            padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500,
            background: filter === f.value ? '#185FA5' : 'rgba(255,255,255,0.06)',
            color: filter === f.value ? '#fff' : '#667788',
          }}>{f.label}</button>
        ))}
        {filter === 'custom' && (
          <>
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ width: 140 }} />
            <span style={{ color: '#667788' }}>→</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ width: 140 }} />
          </>
        )}
      </div>

      {data && (
        <div style={{ fontSize: 12, color: '#667788', marginBottom: 16 }}>
          Periode: {data.startDate} → {data.endDate}
        </div>
      )}

      <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['#', 'Sælger', 'Score', 'Opkald', 'Booket', 'Afholdt', 'Salg', 'Units', 'Opgaver'].map(h => (
                <th key={h} style={{ textAlign: h === '#' || h === 'Score' || h === 'Opkald' ? 'center' : 'left', padding: '14px 14px', fontSize: 11, color: '#667788', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!data && <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#667788', fontSize: 13 }}>Indlæser…</td></tr>}
            {data?.rows.map((row, i) => {
              const isMe = me?.id === row.id;
              return (
                <tr key={row.id} style={{
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  background: isMe ? 'rgba(24,95,165,0.08)' : 'transparent',
                }}>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: 16 }}>
                    {MEDAL[i] || <span style={{ color: '#667788', fontSize: 13 }}>{i + 1}</span>}
                  </td>
                  <td style={{ fontSize: 13, fontWeight: isMe ? 700 : 500, color: isMe ? '#185FA5' : '#ECF0F1' }}>
                    {row.name}{isMe && <span style={{ fontSize: 10, color: '#667788', marginLeft: 6 }}>dig</span>}
                  </td>
                  <td style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, color: '#ECF0F1', fontVariantNumeric: 'tabular-nums' }}>
                    {row.activity_score.toLocaleString('da-DK')}
                  </td>
                  <td style={{ textAlign: 'center', fontSize: 13, color: '#667788', fontVariantNumeric: 'tabular-nums' }}>{row.total_calls}</td>
                  <td style={{ textAlign: 'center', fontSize: 13, color: '#667788', fontVariantNumeric: 'tabular-nums' }}>{row.total_booked}</td>
                  <td style={{ textAlign: 'center', fontSize: 13, color: '#667788', fontVariantNumeric: 'tabular-nums' }}>{row.total_held}</td>
                  <td style={{ textAlign: 'center', fontSize: 13, color: '#667788', fontVariantNumeric: 'tabular-nums' }}>{row.total_sales}</td>
                  <td style={{ textAlign: 'center', fontSize: 13, color: '#667788', fontVariantNumeric: 'tabular-nums' }}>{row.total_units}</td>
                  <td style={{ fontSize: 12, color: '#667788' }}>{row.task_count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16, fontSize: 11, color: '#667788' }}>
        Activity score = opkald × 1 + kontakter × 2 + booket × 5 + afholdt × 3
      </div>
    </div>
  );
}
