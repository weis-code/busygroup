'use client';

import { useEffect, useState, useCallback } from 'react';

const CR = '#f43f5e';

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active:  { label: 'Aktiv',   color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  trial:   { label: 'Trial',   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  paused:  { label: 'Pause',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  churned: { label: 'Opsagt',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
};

type Creator = Record<string, unknown> & {
  id: string;
  _status: string;
  _notes: string | null;
  _status_updated_at: string | null;
};

function getName(c: Creator): string {
  return (
    (c.full_name as string) ||
    (c.name as string) ||
    (c.display_name as string) ||
    (c.username as string) ||
    '—'
  );
}

function getEmail(c: Creator): string {
  return (c.email as string) || '—';
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CreatorRateCreatorsPage() {
  const [creators, setCreators]   = useState<Creator[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selected, setSelected]   = useState<Creator | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes]   = useState('');
  const [saving, setSaving]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetch('/api/creatorrate/creators').then(async r => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({})) as { error?: string };
          throw new Error(b.error ?? `Fejl ${r.status}`);
        }
        return r.json() as Promise<Creator[]>;
      });
      setCreators(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ukendt fejl');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openDetail(c: Creator) {
    setSelected(c);
    setEditStatus(c._status);
    setEditNotes(c._notes ?? '');
  }

  async function saveStatus() {
    if (!selected) return;
    setSaving(true);
    try {
      await fetch(`/api/creatorrate/creators/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: editStatus, notes: editNotes || null }),
      });
      setSelected(prev => prev ? { ...prev, _status: editStatus, _notes: editNotes || null } : prev);
      setCreators(prev => prev.map(c => c.id === selected.id ? { ...c, _status: editStatus, _notes: editNotes || null } : c));
    } finally {
      setSaving(false);
    }
  }

  const filtered = creators.filter(c => {
    const matchSearch = search === '' ||
      getName(c).toLowerCase().includes(search.toLowerCase()) ||
      getEmail(c).toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c._status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    active:  creators.filter(c => c._status === 'active').length,
    trial:   creators.filter(c => c._status === 'trial').length,
    paused:  creators.filter(c => c._status === 'paused').length,
    churned: creators.filter(c => c._status === 'churned').length,
  };

  const mrr = counts.active * 5;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1020 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', margin: 0, marginBottom: 4 }}>Creators</h1>
        <div style={{ fontSize: 12, color: 'var(--t3)' }}>
          CreatorRate · {creators.length} creators · MRR ${mrr.toLocaleString('en-US')}
        </div>
      </div>

      {/* Status summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {(Object.keys(STATUS_META) as string[]).map(s => {
          const meta = STATUS_META[s];
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
              style={{
                background: statusFilter === s ? meta.bg : 'var(--s1)',
                border: `1px solid ${statusFilter === s ? meta.color : 'var(--bd)'}`,
                borderRadius: 10, padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 800, color: meta.color, letterSpacing: '-0.02em' }}>
                {counts[s as keyof typeof counts]}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: meta.color, marginTop: 2 }}>{meta.label}</div>
            </button>
          );
        })}
      </div>

      {/* Search + status filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Søg på navn eller email…"
          style={{ flex: 1, maxWidth: 320 }}
        />
        {statusFilter !== 'all' && (
          <button
            onClick={() => setStatusFilter('all')}
            style={{ fontSize: 12, color: 'var(--t3)', background: 'none', border: '1px solid var(--bd)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}
          >
            Ryd filter ×
          </button>
        )}
      </div>

      {/* List */}
      {error ? (
        <div style={{ padding: '14px 16px', background: 'var(--re2)', borderRadius: 10, fontSize: 13, color: 'var(--re)' }}>
          {error}
        </div>
      ) : (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Henter creators…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Ingen creators matcher søgningen.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--s2)' }}>
                  <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Navn</th>
                  <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</th>
                  <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</th>
                  <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Oprettet</th>
                  <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>MRR</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const sm = STATUS_META[c._status] ?? STATUS_META.active;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => openDetail(c)}
                      style={{ borderTop: i > 0 ? '1px solid var(--bd)' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ padding: '11px 14px', color: 'var(--t1)', fontWeight: 500 }}>{getName(c)}</td>
                      <td style={{ padding: '11px 14px', color: 'var(--t3)' }}>{getEmail(c)}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 100, background: sm.bg, color: sm.color }}>
                          {sm.label}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', color: 'var(--t3)', fontSize: 12 }}>
                        {fmtDate(c.created_at as string)}
                      </td>
                      <td style={{ padding: '11px 14px', color: c._status === 'active' ? '#10b981' : 'var(--t3)', fontWeight: c._status === 'active' ? 600 : 400 }}>
                        {c._status === 'active' ? '$5' : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <div style={{ background: 'var(--s1)', borderRadius: 14, padding: 28, width: 460, maxWidth: '94vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>{getName(selected)}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{getEmail(selected)}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 4px' }}>×</button>
            </div>

            <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>Oprettet: {fmtDate(selected.created_at as string)}</div>

            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</label>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {(Object.keys(STATUS_META) as string[]).map(s => {
                  const meta = STATUS_META[s];
                  const active = editStatus === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setEditStatus(s)}
                      style={{
                        padding: '6px 14px', borderRadius: 100,
                        border: `1px solid ${active ? meta.color : 'var(--bd)'}`,
                        background: active ? meta.bg : 'transparent',
                        color: active ? meta.color : 'var(--t3)',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Noter</label>
              <textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="F.eks. årsag til opsigelse…"
                rows={2}
                style={{ width: '100%', marginTop: 6, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
              <button onClick={() => setSelected(null)} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12 }}>
                Luk
              </button>
              <button
                onClick={() => void saveStatus()}
                disabled={saving}
                style={{ background: CR, color: '#fff', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600, opacity: saving ? 0.7 : 1, cursor: saving ? 'default' : 'pointer' }}
              >
                {saving ? 'Gemmer…' : 'Gem'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
