'use client';

import { useEffect, useState } from 'react';

type Filter = 'active_period' | 'this_week' | 'this_month' | 'custom';

interface Row {
  id: string; name: string; activity_score: number; total_calls: number;
  total_booked: number; total_held: number; total_sales: number; total_units: number; task_count: number;
}

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'active_period', label: 'Aktiv lønperiode' },
  { value: 'this_week',     label: 'Denne uge' },
  { value: 'this_month',    label: 'Denne måned' },
  { value: 'custom',        label: 'Tilpasset' },
];

const MEDAL: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };

export default function LeaderboardPage() {
  const [filter, setFilter]           = useState<Filter>('active_period');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd]     = useState('');
  const [data, setData]               = useState<{ rows: Row[]; startDate: string; endDate: string } | null>(null);
  const [me, setMe]                   = useState<{ id: string } | null>(null);

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
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Leaderboard</h1>
        <p style={{ fontSize: 12, color: 'var(--t3)' }}>Rangeret efter activity score</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)} style={{
            padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500,
            background: filter === f.value ? 'var(--bl)' : 'var(--bd)',
            color: filter === f.value ? '#fff' : 'var(--t2)',
          }}>{f.label}</button>
        ))}
        {filter === 'custom' && (
          <>
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ width: 140 }} />
            <span style={{ color: 'var(--t3)' }}>→</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ width: 140 }} />
          </>
        )}
      </div>

      {data && (
        <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 14 }}>
          Periode: {data.startDate} → {data.endDate}
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {['#', 'Sælger', 'Score', 'Opkald', 'Booket', 'Afholdt', 'Salg', 'Units', 'Opgaver'].map(h => (
                <th key={h} style={{ textAlign: ['#', 'Score', 'Opkald', 'Booket', 'Afholdt', 'Salg', 'Units'].includes(h) ? 'center' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!data && <tr className="empty-row"><td colSpan={9}>Indlæser…</td></tr>}
            {data?.rows.map((row, i) => {
              const isMe = me?.id === row.id;
              return (
                <tr key={row.id} style={{ background: isMe ? 'var(--bl3)' : 'transparent' }}>
                  <td style={{ textAlign: 'center', fontSize: 16 }}>
                    {MEDAL[i] || <span style={{ color: 'var(--t3)', fontSize: 13, fontWeight: 600 }}>{i + 1}</span>}
                  </td>
                  <td style={{ fontWeight: isMe ? 700 : 500, color: isMe ? 'var(--bl)' : 'var(--t1)' }} className={isMe ? '' : 'td-primary'}>
                    {row.name}{isMe && <span style={{ fontSize: 10, color: 'var(--t3)', marginLeft: 6 }}>dig</span>}
                  </td>
                  <td style={{ textAlign: 'center', fontSize: 15, fontWeight: 700, color: 'var(--t1)', fontVariantNumeric: 'tabular-nums' }}>
                    {row.activity_score.toLocaleString('da-DK')}
                  </td>
                  {[row.total_calls, row.total_booked, row.total_held, row.total_sales, row.total_units].map((v, j) => (
                    <td key={j} style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{v}</td>
                  ))}
                  <td>{row.task_count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: 'var(--t4)' }}>
        Activity score = opkald × 1 + kontakter × 2 + booket × 5 + afholdt × 3
      </div>
    </div>
  );
}
