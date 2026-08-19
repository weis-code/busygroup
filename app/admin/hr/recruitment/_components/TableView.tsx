'use client';

import { useMemo, useState } from 'react';
import { stageConfig, sourceLabel, fmtDateShort } from '@/lib/recruitment';
import type { Candidate } from './types';

type SortKey = 'full_name' | 'applying_for' | 'company_name' | 'source' | 'stage' | 'assigned_to_name' | 'start_date' | 'applied_at' | 'days_in_stage' | 'checklist_done' | 'comment_count';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'full_name', label: 'Navn' },
  { key: 'applying_for', label: 'Stilling' },
  { key: 'company_name', label: 'Firma' },
  { key: 'source', label: 'Kilde' },
  { key: 'stage', label: 'Stadie' },
  { key: 'assigned_to_name', label: 'Tildelt' },
  { key: 'start_date', label: 'Opstart' },
  { key: 'applied_at', label: 'Ansøgt' },
  { key: 'days_in_stage', label: 'Dage i stadie' },
  { key: 'checklist_done', label: 'Tjekliste' },
  { key: 'comment_count', label: 'Kommentarer' },
];

export default function TableView({ candidates, onOpen }: { candidates: Candidate[]; onOpen: (id: number) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>('applied_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const arr = [...candidates];
    arr.sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [candidates, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {COLUMNS.map(col => (
              <th key={col.key} onClick={() => toggleSort(col.key)}
                style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' }}>
                {col.label} {sortKey === col.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(c => {
            const stage = stageConfig(c.stage);
            return (
              <tr key={c.id} onClick={() => onOpen(c.id)}
                style={{ cursor: 'pointer', borderBottom: '1px solid var(--bd)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '9px 10px', fontWeight: 600, color: 'var(--t1)' }}>{c.full_name}</td>
                <td style={{ padding: '9px 10px', color: 'var(--t2)' }}>{c.applying_for}</td>
                <td style={{ padding: '9px 10px' }}>
                  {c.company_name && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: `${c.company_color ?? '#4f8ef7'}22`, color: c.company_color ?? '#4f8ef7' }}>
                      {c.company_name}
                    </span>
                  )}
                </td>
                <td style={{ padding: '9px 10px', color: 'var(--t2)' }}>{sourceLabel(c.source)}</td>
                <td style={{ padding: '9px 10px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: `${stage?.color ?? 'var(--t2)'}18`, color: stage?.color ?? 'var(--t2)' }}>
                    {stage?.label ?? c.stage}
                  </span>
                </td>
                <td style={{ padding: '9px 10px', color: 'var(--t2)' }}>{c.assigned_to_name ?? '—'}</td>
                <td style={{ padding: '9px 10px', color: 'var(--t2)' }}>{c.start_date ? fmtDateShort(c.start_date) : '—'}</td>
                <td style={{ padding: '9px 10px', color: 'var(--t2)' }}>{c.applied_at ? fmtDateShort(c.applied_at) : '—'}</td>
                <td style={{ padding: '9px 10px', color: 'var(--t2)' }}>{c.days_in_stage}</td>
                <td style={{ padding: '9px 10px', color: 'var(--t2)' }}>
                  {c.stage === 'ansat' && c.checklist_total > 0 ? `${c.checklist_done}/${c.checklist_total}` : '—'}
                </td>
                <td style={{ padding: '9px 10px', color: 'var(--t3)' }}>{c.comment_count > 0 ? `💬 ${c.comment_count}` : ''}</td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr><td colSpan={COLUMNS.length} style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--t3)' }}>Ingen kandidater</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
