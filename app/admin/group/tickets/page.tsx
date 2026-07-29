'use client';

import { useEffect, useState, useCallback } from 'react';

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  open:        { label: 'Åben',   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  in_progress: { label: 'I gang', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  resolved:    { label: 'Løst',   color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  closed:      { label: 'Lukket', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  low:    { label: 'Lav',    color: '#6b7280' },
  normal: { label: 'Normal', color: '#3b82f6' },
  high:   { label: 'Høj',   color: '#f59e0b' },
  urgent: { label: 'Akut',  color: '#ef4444' },
};

const STATUS_FLOW = ['open', 'in_progress', 'resolved', 'closed'];

interface Ticket {
  id: number;
  type: string;
  status: string;
  priority: string;
  title: string;
  description: string | null;
  assignee_name: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

const EMPTY_FORM = { priority: 'normal', title: '', description: '' };

export default function GroupTicketsPage() {
  const [statusFilter, setStatusFilter] = useState('open');
  const [tickets, setTickets]           = useState<Ticket[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selected, setSelected]         = useState<Ticket | null>(null);
  const [showCreate, setShowCreate]     = useState(false);
  const [form, setForm]                 = useState({ ...EMPTY_FORM });
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ source: 'group', type: 'dev' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const data = await fetch(`/api/tickets?${params}`).then(r => r.json()) as Ticket[];
      setTickets(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  async function createTicket() {
    if (!form.title) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'group',
          type: 'dev',
          priority: form.priority,
          title: form.title,
          description: form.description || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setSaveError(body.error ?? `Fejl ${res.status}`);
        return;
      }
      setForm({ ...EMPTY_FORM });
      setShowCreate(false);
      setStatusFilter('open');
      await load();
    } catch {
      setSaveError('Netværksfejl — prøv igen');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: number, status: string) {
    await fetch(`/api/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setSelected(prev => prev ? { ...prev, status } : prev);
    await load();
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const openCount   = tickets.filter(t => t.status === 'open').length;
  const inProgCount = tickets.filter(t => t.status === 'in_progress').length;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 980 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', margin: 0, marginBottom: 4 }}>Udviklings-tickets</h1>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>
            NL Group · {openCount} åbne{inProgCount > 0 ? ` · ${inProgCount} i gang` : ''}
          </div>
        </div>
        <button
          onClick={() => { setForm({ ...EMPTY_FORM }); setShowCreate(true); }}
          style={{ background: 'var(--t2)', color: 'var(--bg)', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          + Opret ticket
        </button>
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', ...STATUS_FLOW].map(s => {
          const meta = s === 'all' ? null : STATUS_META[s];
          const active = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: '4px 12px', borderRadius: 100,
                border: `1px solid ${active ? (meta?.color ?? 'var(--t1)') : 'var(--bd)'}`,
                background: active ? (meta?.bg ?? 'rgba(0,0,0,0.06)') : 'transparent',
                color: active ? (meta?.color ?? 'var(--t1)') : 'var(--t3)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {s === 'all' ? 'Alle' : meta?.label}
            </button>
          );
        })}
      </div>

      {/* Ticket list */}
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Henter tickets…</div>
        ) : tickets.length === 0 ? (
          <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
            Ingen tickets.{' '}
            <button onClick={() => setShowCreate(true)} style={{ color: 'var(--t1)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              Opret den første →
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--s2)' }}>
                <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', width: 44 }}>#</th>
                <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Titel</th>
                <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Prioritet</th>
                <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</th>
                <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dato</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t, i) => {
                const sm = STATUS_META[t.status] ?? STATUS_META.open;
                const pm = PRIORITY_META[t.priority] ?? PRIORITY_META.normal;
                return (
                  <tr
                    key={t.id}
                    onClick={() => setSelected(t)}
                    style={{ borderTop: i > 0 ? '1px solid var(--bd)' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '11px 14px', color: 'var(--t3)', fontSize: 12 }}>#{t.id}</td>
                    <td style={{ padding: '11px 14px', color: 'var(--t1)', fontWeight: 500, maxWidth: 400 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: pm.color }}>{pm.label}</span>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 100, background: sm.bg, color: sm.color }}>
                        {sm.label}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--t3)', fontSize: 12 }}>{fmtDate(t.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <div style={{ background: 'var(--s1)', borderRadius: 14, padding: 28, width: 520, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>#{selected.id} · Udvikling</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>{selected.title}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 4px' }}>×</button>
            </div>

            {selected.description && (
              <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 20, padding: '12px 14px', background: 'var(--s2)', borderRadius: 8 }}>
                {selected.description}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20, fontSize: 12 }}>
              <div>
                <div style={{ color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, marginBottom: 3 }}>Prioritet</div>
                <div style={{ color: PRIORITY_META[selected.priority]?.color ?? 'var(--t1)', fontWeight: 700 }}>
                  {PRIORITY_META[selected.priority]?.label ?? selected.priority}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, marginBottom: 3 }}>Oprettet af</div>
                <div style={{ color: 'var(--t1)' }}>{selected.created_by_name ?? '—'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, marginBottom: 3 }}>Oprettet</div>
                <div style={{ color: 'var(--t1)' }}>{fmtDate(selected.created_at)}</div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Skift status</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {STATUS_FLOW.map(s => {
                  const meta = STATUS_META[s];
                  const isCurrent = selected.status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => !isCurrent && void updateStatus(selected.id, s)}
                      style={{
                        padding: '6px 14px', borderRadius: 100,
                        border: `1px solid ${isCurrent ? meta.color : 'var(--bd)'}`,
                        background: isCurrent ? meta.bg : 'transparent',
                        color: isCurrent ? meta.color : 'var(--t3)',
                        fontSize: 12, fontWeight: 600,
                        cursor: isCurrent ? 'default' : 'pointer',
                      }}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowCreate(false); setSaveError(null); } }}
        >
          <div style={{ background: 'var(--s1)', borderRadius: 14, padding: 28, width: 460, maxWidth: '94vw' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 20 }}>Opret udviklings-ticket</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Titel *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Beskriv opgaven kort"
                  autoFocus
                  style={{ width: '100%', marginTop: 4 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Beskrivelse</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Uddyb hvad der skal laves…"
                  rows={3}
                  style={{ width: '100%', marginTop: 4, resize: 'vertical' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Prioritet</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={{ width: '100%', marginTop: 4 }}>
                  <option value="low">Lav</option>
                  <option value="normal">Normal</option>
                  <option value="high">Høj</option>
                  <option value="urgent">Akut</option>
                </select>
              </div>
            </div>

            {saveError && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--re2)', borderRadius: 7, fontSize: 12, color: 'var(--re)' }}>
                {saveError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowCreate(false); setSaveError(null); }}
                style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12 }}
              >
                Annuller
              </button>
              <button
                onClick={() => void createTicket()}
                disabled={!form.title || saving}
                style={{ background: 'var(--t1)', color: 'var(--bg)', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600, opacity: saving ? 0.7 : 1, cursor: saving ? 'default' : 'pointer' }}
              >
                {saving ? 'Opretter…' : 'Opret ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
