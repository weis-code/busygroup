'use client';

import { useEffect, useState } from 'react';

interface ActivityRow {
  id: number; type: string; direction: string | null; title: string; body: string | null;
  outcome: string | null; duration_minutes: number | null;
  next_action: string | null; next_action_date: string | null; next_action_done: boolean;
  owner_name: string; created_at: string;
  deal_id: number; deal_title: string | null; deal_stage: string | null;
  contact_name: string | null; contact_company: string | null;
}

const TYPE_META: Record<string, { icon: string; label: string }> = {
  call:      { icon: '📞', label: 'Opkald' },
  email:     { icon: '📧', label: 'Email' },
  meeting:   { icon: '🤝', label: 'Møde' },
  demo:      { icon: '💻', label: 'Demo' },
  proposal:  { icon: '📄', label: 'Tilbud' },
  follow_up: { icon: '🔔', label: 'Opfølgning' },
  linkedin:  { icon: '🔗', label: 'LinkedIn' },
  note:      { icon: '📝', label: 'Note' },
};

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', kontaktet: 'Kontaktet', demo: 'Demo',
  tilbud: 'Tilbud', forhandling: 'Forhandling', vundet: 'Vundet', tabt: 'Tabt',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Lige nu';
  if (m < 60) return `${m} min siden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} t siden`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d siden`;
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return dateStr < new Date().toISOString().slice(0, 10);
}

function fmtDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

export default function CrmActivityPage() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const limit = 50;

  async function load(p = 1) {
    setLoading(true);
    const sp = new URLSearchParams({ page: String(p), limit: String(limit) });
    if (filterType) sp.set('type', filterType);
    if (filterFrom) sp.set('from', filterFrom);
    if (filterTo) sp.set('to', filterTo);
    const data = await fetch(`/api/crm/activity?${sp}`).then(r => r.json()) as { rows: ActivityRow[]; total: number };
    if (Array.isArray(data.rows)) { setRows(data.rows); setTotal(data.total ?? 0); }
    setLoading(false);
  }

  useEffect(() => { load(page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  function search() { setPage(1); load(1); }

  async function markDone(id: number) {
    await fetch(`/api/crm/touchpoints/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ next_action_done: true }) });
    load(page);
  }

  async function del(id: number) {
    if (!confirm('Slet denne aktivitet?')) return;
    await fetch(`/api/crm/touchpoints/${id}`, { method: 'DELETE' });
    load(page);
  }

  const pages = Math.ceil(total / limit);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Aktivitetsfeed</h1>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>{total} aktiviteter i alt</div>
        </div>
        <a href="/admin/crm" style={{ fontSize: 12, color: 'var(--bl)', textDecoration: 'none', padding: '8px 14px', background: 'var(--bl2)', borderRadius: 7 }}>← Pipeline</a>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 'auto' }}>
          <option value="">Alle typer</option>
          {Object.entries(TYPE_META).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ marginBottom: 0, textTransform: 'none', letterSpacing: 0, fontSize: 12, color: 'var(--t3)' }}>Fra</label>
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={{ width: 140 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ marginBottom: 0, textTransform: 'none', letterSpacing: 0, fontSize: 12, color: 'var(--t3)' }}>Til</label>
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={{ width: 140 }} />
        </div>
        <button onClick={search} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600 }}>
          Filtrer
        </button>
        <button onClick={() => { setFilterType(''); setFilterFrom(''); setFilterTo(''); setPage(1); load(1); }} style={{ background: 'var(--s2)', color: 'var(--t3)', border: '1px solid var(--bd)', borderRadius: 7, padding: '7px 12px', fontSize: 12 }}>
          Nulstil
        </button>
      </div>

      {/* Activity list */}
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 11, overflow: 'hidden' }}>
        {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>}

        {!loading && rows.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Ingen aktiviteter</div>
        )}

        {!loading && rows.map((row, idx) => {
          const meta = TYPE_META[row.type] ?? { icon: '•', label: row.type };
          const overdue = row.next_action && !row.next_action_done && isOverdue(row.next_action_date);
          return (
            <div key={row.id} style={{ display: 'flex', gap: 14, padding: '14px 18px', borderBottom: idx < rows.length - 1 ? '1px solid var(--bd)' : 'none', transition: 'background 0.1s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.015)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0, marginTop: 2 }}>
                {meta.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 2 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>{row.title}</span>
                    {row.deal_title && (
                      <span style={{ fontSize: 11, color: 'var(--t3)', marginLeft: 8 }}>
                        <a href="/admin/crm" style={{ color: 'var(--bl)', textDecoration: 'none' }}>{row.deal_title}</a>
                        {row.deal_stage && <span style={{ color: 'var(--t4)', marginLeft: 4 }}>· {STAGE_LABELS[row.deal_stage] ?? row.deal_stage}</span>}
                      </span>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--t3)' }}>{timeAgo(row.created_at)}</div>
                    <div style={{ fontSize: 10, color: 'var(--t4)' }}>{row.owner_name}</div>
                  </div>
                </div>
                {(row.contact_name || row.contact_company) && (
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>{row.contact_name}{row.contact_company && ` · ${row.contact_company}`}</div>
                )}
                {row.body && <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5, marginBottom: 5 }}>{row.body}</div>}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {row.outcome && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 100, background: 'var(--s2)', color: 'var(--t2)', fontWeight: 600 }}>{row.outcome}</span>}
                  {row.duration_minutes && <span style={{ fontSize: 10, color: 'var(--t3)', padding: '2px 6px', borderRadius: 100, background: 'var(--s2)' }}>{row.duration_minutes} min</span>}
                  {row.next_action && !row.next_action_done && (
                    <span style={{ fontSize: 10, color: overdue ? 'var(--re)' : 'var(--or)', background: overdue ? 'var(--re2)' : 'var(--or2)', padding: '2px 8px', borderRadius: 100, fontWeight: 600 }}>
                      {overdue ? '⚠ ' : ''}Næste: {row.next_action}{row.next_action_date ? ` · ${fmtDate(row.next_action_date)}` : ''}
                    </span>
                  )}
                  {row.next_action && !row.next_action_done && (
                    <button onClick={() => markDone(row.id)} style={{ fontSize: 10, color: 'var(--gr)', background: 'var(--gr2)', border: 'none', borderRadius: 100, padding: '2px 8px', fontWeight: 600, cursor: 'pointer' }}>✓ Udført</button>
                  )}
                  <button onClick={() => del(row.id)} style={{ fontSize: 10, color: 'var(--re)', background: 'none', border: 'none', padding: '2px 6px', cursor: 'pointer', opacity: 0.6 }}>Slet</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 16 }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 12px', borderRadius: 7, background: 'var(--s2)', border: '1px solid var(--bd)', color: 'var(--t2)', fontSize: 12 }}>← Forrige</button>
          <span style={{ fontSize: 12, color: 'var(--t3)', padding: '6px 12px' }}>{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 12px', borderRadius: 7, background: 'var(--s2)', border: '1px solid var(--bd)', color: 'var(--t2)', fontSize: 12 }}>Næste →</button>
        </div>
      )}
    </div>
  );
}
