'use client';

import { useEffect, useState } from 'react';
import type { Activity } from '../_components/types';
import { TYPE_META, fmtDate, isOverdue } from '../_components/types';

interface NextAction { lead_id: number; company_name: string; next_action: string; next_action_date: string; type: string }
interface Overview { nextActions: NextAction[]; activitiesThisWeek: number }

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Lige nu';
  if (m < 60) return `${m} min siden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} t siden`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d} d siden` : new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

function groupLabel(dateStr: string) {
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const weekAgo   = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  if (dateStr === today)          return 'I dag';
  if (dateStr === yesterday)      return 'I går';
  if (dateStr >= weekAgo)         return 'Denne uge';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });
}

export default function MeridianActivityPage() {
  const [activities, setActivities]   = useState<Activity[]>([]);
  const [overview, setOverview]       = useState<Overview | null>(null);
  const [typeFilter, setTypeFilter]   = useState('');
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/meridian/crm/activities').then(r => r.json()) as Promise<Activity[]>,
      fetch('/api/meridian/crm/overview').then(r => r.json()) as Promise<Overview>,
    ]).then(([acts, ov]) => {
      setActivities(Array.isArray(acts) ? acts : []);
      setOverview(ov);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = typeFilter ? activities.filter(a => a.type === typeFilter) : activities;

  // Group by date
  const groups: { label: string; items: Activity[] }[] = [];
  let lastLabel = '';
  for (const a of filtered) {
    const label = groupLabel(a.occurred_at.slice(0, 10));
    if (label !== lastLabel) { groups.push({ label, items: [] }); lastLabel = label; }
    groups[groups.length - 1].items.push(a);
  }

  const today = new Date().toISOString().slice(0, 10);
  const nextOverdue = overview?.nextActions.filter(a => a.next_action_date < today) ?? [];
  const nextToday   = overview?.nextActions.filter(a => a.next_action_date === today) ?? [];
  const nextSoon    = overview?.nextActions.filter(a => a.next_action_date > today && a.next_action_date <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)) ?? [];

  return (
    <div style={{ padding: '24px 32px', maxWidth: 920 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 3 }}>Aktivitetsfeed</h1>
        <div style={{ fontSize: 12, color: 'var(--t3)' }}>Alle dine aktiviteter på tværs af leads</div>
      </div>

      {/* Stats this week */}
      {overview && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, padding: '5px 10px', background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 7, color: 'var(--t2)' }}>
            Denne uge: <strong style={{ color: 'var(--t1)' }}>{overview.activitiesThisWeek}</strong> aktiviteter
          </div>
          {Object.entries(TYPE_META).map(([key, meta]) => {
            const c = activities.filter(a => a.type === key && a.occurred_at >= new Date(Date.now() - 7 * 86400000).toISOString()).length;
            if (!c) return null;
            return (
              <div key={key} style={{ fontSize: 11, padding: '5px 10px', background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 7, color: 'var(--t2)' }}>
                {meta.icon} {meta.label}: <strong style={{ color: 'var(--t1)' }}>{c}</strong>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
        {/* Activity log */}
        <div>
          {/* Type filter */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            <button onClick={() => setTypeFilter('')}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--bd)', background: !typeFilter ? 'var(--bl2)' : 'var(--s1)', color: !typeFilter ? 'var(--bl)' : 'var(--t2)', cursor: 'pointer' }}>
              Alle
            </button>
            {Object.entries(TYPE_META).map(([key, meta]) => (
              <button key={key} onClick={() => setTypeFilter(k => k === key ? '' : key)}
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--bd)', background: typeFilter === key ? 'var(--bl2)' : 'var(--s1)', color: typeFilter === key ? 'var(--bl)' : 'var(--t2)', cursor: 'pointer' }}>
                {meta.icon} {meta.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ color: 'var(--t3)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Indlæser…</div>
          ) : filtered.length === 0 ? (
            <div style={{ color: 'var(--t3)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Ingen aktiviteter endnu</div>
          ) : (
            groups.map(g => (
              <div key={g.label} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{g.label}</div>
                {g.items.map(a => (
                  <div key={a.id} style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{TYPE_META[a.type]?.icon ?? '•'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{TYPE_META[a.type]?.label}</span>
                        <span style={{ fontSize: 10, color: 'var(--t3)' }}>{timeAgo(a.occurred_at)}</span>
                        {a.company_name && <span style={{ fontSize: 10, color: 'var(--t3)' }}>· {a.company_name}</span>}
                      </div>
                      {a.outcome && <span style={{ fontSize: 10, padding: '2px 6px', background: 'var(--s3)', borderRadius: 4, color: 'var(--t2)', display: 'inline-block', marginBottom: 3 }}>{a.outcome}</span>}
                      {a.body && <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5 }}>{a.body}</div>}
                      {a.next_action && (
                        <div style={{ fontSize: 11, marginTop: 4, color: isOverdue(a.next_action_date) ? 'var(--re)' : 'var(--t3)' }}>
                          📅 {a.next_action}{a.next_action_date ? ` · ${fmtDate(a.next_action_date)}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Next actions panel */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Næste handlinger</div>
          {nextOverdue.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--re)', letterSpacing: '0.07em', marginBottom: 6 }}>OVERSKREDET</div>
              {nextOverdue.map((n, i) => <NextItem key={i} item={n} overdue />)}
            </div>
          )}
          {nextToday.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ye)', letterSpacing: '0.07em', marginBottom: 6 }}>I DAG</div>
              {nextToday.map((n, i) => <NextItem key={i} item={n} />)}
            </div>
          )}
          {nextSoon.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.07em', marginBottom: 6 }}>DENNE UGE</div>
              {nextSoon.map((n, i) => <NextItem key={i} item={n} />)}
            </div>
          )}
          {nextOverdue.length === 0 && nextToday.length === 0 && nextSoon.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--t3)', padding: '12px 0' }}>Ingen kommende handlinger</div>
          )}
        </div>
      </div>
    </div>
  );
}

function NextItem({ item, overdue }: { item: NextAction; overdue?: boolean }) {
  return (
    <div style={{ padding: '8px 10px', background: 'var(--s1)', border: `1px solid ${overdue ? 'rgba(244,63,94,0.2)' : 'var(--bd)'}`, borderRadius: 7, marginBottom: 5 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)', marginBottom: 2 }}>{item.company_name}</div>
      <div style={{ fontSize: 11, color: overdue ? 'var(--re)' : 'var(--t2)' }}>{item.next_action}</div>
      <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{fmtDate(item.next_action_date)}</div>
    </div>
  );
}
