'use client';

import { useEffect, useState, useCallback } from 'react';

interface Ticket {
  id: number; source: string; customer_name: string; subject: string; type: string;
  status: string; priority: string; assigned_name: string | null;
  message_count: number; latest_message: string | null;
  created_at: string; updated_at: string; resolved_at: string | null;
}
interface Message {
  id: number; ticket_id: number; author_id: string | null; author_name: string;
  is_internal: boolean; body: string; created_at: string;
}
interface TicketDetail extends Ticket { messages: Message[] }

interface Customer { id: number; name: string }
interface TeamUser { id: string; name: string }

/* ── Dev tickets (internal, no customer thread — separate data model) ──── */
const DEV_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  open:        { label: 'Åben',   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  in_progress: { label: 'I gang', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  resolved:    { label: 'Løst',   color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  closed:      { label: 'Lukket', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};
const DEV_PRIORITY_META: Record<string, { label: string; color: string }> = {
  low:    { label: 'Lav',    color: '#6b7280' },
  normal: { label: 'Normal', color: '#3b82f6' },
  high:   { label: 'Høj',   color: '#f59e0b' },
  urgent: { label: 'Akut',  color: '#ef4444' },
};
const DEV_STATUS_FLOW = ['open', 'in_progress', 'resolved', 'closed'];

interface DevTicket {
  id: number; type: string; status: string; priority: string; title: string; description: string | null;
  assignee_name: string | null; created_by_name: string | null; created_at: string; updated_at: string;
}
const EMPTY_DEV_FORM = { priority: 'normal', title: '', description: '' };

function DevTicketsPanel() {
  const [statusFilter, setStatusFilter] = useState('open');
  const [tickets, setTickets] = useState<DevTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DevTicket | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_DEV_FORM });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ source: 'group', type: 'dev' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const data = await fetch(`/api/tickets?${params}`).then(r => r.json()) as DevTicket[];
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'group', type: 'dev', priority: form.priority, title: form.title, description: form.description || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setSaveError(body.error ?? `Fejl ${res.status}`);
        return;
      }
      setForm({ ...EMPTY_DEV_FORM });
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
    await fetch(`/api/tickets/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    setSelected(prev => prev ? { ...prev, status } : prev);
    await load();
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const openCount = tickets.filter(t => t.status === 'open').length;
  const inProgCount = tickets.filter(t => t.status === 'in_progress').length;

  return (
    <div style={{ padding: '20px 24px', maxWidth: 980 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--t3)' }}>
          NL Group · {openCount} åbne{inProgCount > 0 ? ` · ${inProgCount} i gang` : ''}
        </div>
        <button onClick={() => { setForm({ ...EMPTY_DEV_FORM }); setShowCreate(true); }}
          style={{ background: 'var(--t2)', color: 'var(--bg)', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Opret ticket
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', ...DEV_STATUS_FLOW].map(s => {
          const meta = s === 'all' ? null : DEV_STATUS_META[s];
          const active = statusFilter === s;
          return (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: '4px 12px', borderRadius: 100, border: `1px solid ${active ? (meta?.color ?? 'var(--t1)') : 'var(--bd)'}`, background: active ? (meta?.bg ?? 'rgba(0,0,0,0.06)') : 'transparent', color: active ? (meta?.color ?? 'var(--t1)') : 'var(--t3)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {s === 'all' ? 'Alle' : meta?.label}
            </button>
          );
        })}
      </div>

      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Henter tickets…</div>
        ) : tickets.length === 0 ? (
          <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
            Ingen tickets.{' '}
            <button onClick={() => setShowCreate(true)} style={{ color: 'var(--t1)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Opret den første →</button>
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
                const sm = DEV_STATUS_META[t.status] ?? DEV_STATUS_META.open;
                const pm = DEV_PRIORITY_META[t.priority] ?? DEV_PRIORITY_META.normal;
                return (
                  <tr key={t.id} onClick={() => setSelected(t)}
                    style={{ borderTop: i > 0 ? '1px solid var(--bd)' : 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '11px 14px', color: 'var(--t3)', fontSize: 12 }}>#{t.id}</td>
                    <td style={{ padding: '11px 14px', color: 'var(--t1)', fontWeight: 500, maxWidth: 400 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                    </td>
                    <td style={{ padding: '11px 14px' }}><span style={{ fontSize: 11, fontWeight: 700, color: pm.color }}>{pm.label}</span></td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 100, background: sm.bg, color: sm.color }}>{sm.label}</span>
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--t3)', fontSize: 12 }}>{fmtDate(t.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div style={{ background: 'var(--s1)', borderRadius: 14, padding: 28, width: 520, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>#{selected.id} · Udvikling</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>{selected.title}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 4px' }}>×</button>
            </div>
            {selected.description && (
              <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 20, padding: '12px 14px', background: 'var(--s2)', borderRadius: 8 }}>{selected.description}</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20, fontSize: 12 }}>
              <div>
                <div style={{ color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, marginBottom: 3 }}>Prioritet</div>
                <div style={{ color: DEV_PRIORITY_META[selected.priority]?.color ?? 'var(--t1)', fontWeight: 700 }}>{DEV_PRIORITY_META[selected.priority]?.label ?? selected.priority}</div>
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
                {DEV_STATUS_FLOW.map(s => {
                  const meta = DEV_STATUS_META[s];
                  const isCurrent = selected.status === s;
                  return (
                    <button key={s} onClick={() => !isCurrent && void updateStatus(selected.id, s)}
                      style={{ padding: '6px 14px', borderRadius: 100, border: `1px solid ${isCurrent ? meta.color : 'var(--bd)'}`, background: isCurrent ? meta.bg : 'transparent', color: isCurrent ? meta.color : 'var(--t3)', fontSize: 12, fontWeight: 600, cursor: isCurrent ? 'default' : 'pointer' }}>
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowCreate(false); setSaveError(null); } }}>
          <div style={{ background: 'var(--s1)', borderRadius: 14, padding: 28, width: 460, maxWidth: '94vw' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 20 }}>Opret udviklings-ticket</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Titel *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Beskriv opgaven kort" autoFocus style={{ width: '100%', marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Beskrivelse</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Uddyb hvad der skal laves…" rows={3} style={{ width: '100%', marginTop: 4, resize: 'vertical' }} />
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
              <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--re2)', borderRadius: 7, fontSize: 12, color: 'var(--re)' }}>{saveError}</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowCreate(false); setSaveError(null); }} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12 }}>Annuller</button>
              <button onClick={() => void createTicket()} disabled={!form.title || saving}
                style={{ background: 'var(--t1)', color: 'var(--bg)', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600, opacity: saving ? 0.7 : 1, cursor: saving ? 'default' : 'pointer' }}>
                {saving ? 'Opretter…' : 'Opret ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const TYPE_LABELS: Record<string, string>   = { general: 'Generel', change: 'Ændring', error: 'Fejl', question: 'Spørgsmål', other: 'Andet' };
const STATUS_LABELS: Record<string, string> = { open: 'Åben', awaiting_customer: 'Afventer kunde', in_progress: 'I gang', resolved: 'Løst', closed: 'Lukket' };
const STATUS_COLOR: Record<string, string>  = { open: 'var(--bl)', awaiting_customer: 'var(--ye)', in_progress: 'var(--pu)', resolved: 'var(--gr)', closed: 'var(--t3)' };
const PRIORITY_LABELS: Record<string, string> = { low: 'Lav', normal: 'Normal', high: 'Høj', urgent: 'Urgent' };
const PRIORITY_COLOR: Record<string, string>  = { low: 'var(--t3)', normal: 'var(--bl)', high: 'var(--or)', urgent: 'var(--re)' };
const SOURCE_LABELS: Record<string, string> = { meridian: 'Meridian', creatorrate: 'CreatorRate', group: 'Group' };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Lige nu';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} t`;
  const d = Math.floor(h / 24);
  return `${d} dage`;
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 100, background: bg, color }}>{label}</span>
  );
}

export default function SupportPage() {
  const [viewType, setViewType] = useState<'support' | 'dev'>('support');
  const [tickets, setTickets]     = useState<Ticket[]>([]);
  const [detail, setDetail]       = useState<TicketDetail | null>(null);
  const [loading, setLoading]     = useState(true);
  const [sourceFilter, setSourceFilter] = useState(''); // '' = alle virksomheder (koncern-wide default)
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch]       = useState('');
  const [showNew, setShowNew]     = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [replyInternal, setReplyInternal] = useState(false);
  const [sending, setSending]     = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers]         = useState<TeamUser[]>([]);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (sourceFilter)   params.set('source', sourceFilter);
    if (statusFilter)   params.set('status', statusFilter);
    if (priorityFilter) params.set('priority', priorityFilter);
    if (search)         params.set('search', search);
    const data = await fetch('/api/meridian/tickets?' + params.toString()).then(r => r.json()) as Ticket[];
    setTickets(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [sourceFilter, statusFilter, priorityFilter, search]);

  useEffect(() => { void loadTickets(); }, [loadTickets]);

  useEffect(() => {
    fetch('/api/customers?company=meridian').then(r => r.json()).then((d: Customer[]) => setCustomers(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/users?roles=ADMIN,MANAGER').then(r => r.json()).then((d: TeamUser[]) => setUsers(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  async function openTicket(id: number) {
    const data = await fetch(`/api/meridian/tickets/${id}`).then(r => r.json()) as TicketDetail;
    setDetail(data);
  }

  async function updateTicket(patch: Partial<Ticket>) {
    if (!detail) return;
    const updated = await fetch(`/api/meridian/tickets/${detail.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(r => r.json()) as TicketDetail;
    setDetail(prev => prev ? { ...prev, ...updated } : prev);
    void loadTickets();
  }

  async function sendReply() {
    if (!detail || !replyBody.trim() || sending) return;
    setSending(true);
    await fetch(`/api/meridian/tickets/${detail.id}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: replyBody.trim(), is_internal: replyInternal }),
    });
    setSending(false);
    setReplyBody('');
    const updated = await fetch(`/api/meridian/tickets/${detail.id}`).then(r => r.json()) as TicketDetail;
    setDetail(updated);
  }

  const open   = tickets.filter(t => t.status === 'open').length;
  const await_ = tickets.filter(t => t.status === 'awaiting_customer').length;
  const today  = new Date().toISOString().slice(0, 10);
  const resolvedToday = tickets.filter(t => t.resolved_at && t.resolved_at.slice(0, 10) === today).length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ flexShrink: 0, background: 'var(--s1)', borderBottom: '1px solid var(--bd)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>Support</div>
        <div style={{ display: 'flex', gap: 0, border: '1px solid var(--bd)', borderRadius: 7, overflow: 'hidden' }}>
          {(['support', 'dev'] as const).map(v => (
            <button key={v} onClick={() => setViewType(v)}
              style={{ padding: '5px 12px', fontSize: 12, fontWeight: viewType === v ? 700 : 500, border: 'none', cursor: 'pointer', background: viewType === v ? 'var(--bl2)' : 'var(--s1)', color: viewType === v ? 'var(--bl)' : 'var(--t2)' }}>
              {v === 'support' ? 'Kundeservice' : 'Udvikling'}
            </button>
          ))}
        </div>
        {viewType === 'support' && (
          <>
            <div style={{ fontSize: 11, color: 'var(--t3)', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '4px 10px' }}>
              {open} åbne · {await_} afventer · {resolvedToday} løst i dag
            </div>
            <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
              style={{ fontSize: 11, padding: '5px 8px', background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 6, color: 'var(--t2)' }}>
              <option value="">Alle virksomheder</option>
              <option value="meridian">Meridian</option>
              <option value="creatorrate">CreatorRate</option>
            </select>
            <div style={{ display: 'flex', gap: 4 }}>
              {['', 'open', 'awaiting_customer', 'in_progress', 'resolved'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--bd)', background: statusFilter === s ? 'var(--bl2)' : 'var(--s1)', color: statusFilter === s ? 'var(--bl)' : 'var(--t2)', cursor: 'pointer' }}>
                  {s === '' ? 'Alle' : STATUS_LABELS[s]}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['', 'urgent', 'high', 'normal', 'low'].map(p => (
                <button key={p} onClick={() => setPriorityFilter(p)}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--bd)', background: priorityFilter === p ? 'var(--bl2)' : 'var(--s1)', color: priorityFilter === p ? 'var(--bl)' : 'var(--t2)', cursor: 'pointer' }}>
                  {p === '' ? 'Alle' : PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Søg ticket…"
              style={{ fontSize: 12, padding: '6px 10px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 7, color: 'var(--t1)', width: 180 }} />
            <button onClick={() => setShowNew(true)}
              style={{ background: 'var(--bl)', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              + Ny ticket
            </button>
          </>
        )}
      </div>

      {viewType === 'dev' ? (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <DevTicketsPanel />
        </div>
      ) : (
      <>
      {/* Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Ticket table */}
        <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>
          ) : tickets.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Ingen tickets</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--s1)', borderBottom: '1px solid var(--bd)' }}>
                  {['#', 'Selskab', 'Kunde', 'Emne', 'Type', 'Prioritet', 'Status', 'Tildelt', 'Alder', '💬'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => {
                  const isUrgent = t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed';
                  const isSelected = detail?.id === t.id;
                  return (
                    <tr key={t.id} onClick={() => void openTicket(t.id)}
                      style={{ borderBottom: '1px solid var(--bd)', cursor: 'pointer', background: isSelected ? 'var(--bl2)' : 'transparent', borderLeft: isUrgent ? '3px solid var(--re)' : '3px solid transparent', transition: 'background 0.1s' }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--s2)'; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--t3)' }}>#{t.id}</td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--t3)', whiteSpace: 'nowrap' }}>{SOURCE_LABELS[t.source] ?? t.source}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: 'var(--t1)', whiteSpace: 'nowrap' }}>{t.customer_name}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--t1)', maxWidth: 240 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>
                        {t.latest_message && <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.latest_message}</div>}
                      </td>
                      <td style={{ padding: '10px 12px' }}><Badge label={TYPE_LABELS[t.type] ?? t.type} color="var(--t2)" bg="var(--s3)" /></td>
                      <td style={{ padding: '10px 12px' }}><Badge label={PRIORITY_LABELS[t.priority] ?? t.priority} color={PRIORITY_COLOR[t.priority] ?? 'var(--t2)'} bg={`${PRIORITY_COLOR[t.priority] ?? 'var(--t2)'}22`} /></td>
                      <td style={{ padding: '10px 12px' }}><Badge label={STATUS_LABELS[t.status] ?? t.status} color={STATUS_COLOR[t.status] ?? 'var(--t2)'} bg={`${STATUS_COLOR[t.status] ?? 'var(--t2)'}22`} /></td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--t3)' }}>{t.assigned_name ?? '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--t3)', whiteSpace: 'nowrap' }}>{timeAgo(t.created_at)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--t3)' }}>{t.message_count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail panel */}
        {detail && (
          <div style={{ width: 420, flexShrink: 0, borderLeft: '1px solid var(--bd)', background: 'var(--s1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 3 }}>{detail.subject}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>{SOURCE_LABELS[detail.source] ?? detail.source} · {detail.customer_name} · #{detail.id}</div>
                </div>
                <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 18, marginLeft: 8 }}>×</button>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <select value={detail.status} onChange={e => void updateTicket({ status: e.target.value })}
                  style={{ fontSize: 11, padding: '4px 8px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 6, color: STATUS_COLOR[detail.status] ?? 'var(--t1)', fontWeight: 600 }}>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <select value={detail.priority} onChange={e => void updateTicket({ priority: e.target.value })}
                  style={{ fontSize: 11, padding: '4px 8px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 6, color: PRIORITY_COLOR[detail.priority] ?? 'var(--t1)', fontWeight: 600 }}>
                  {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <select value={detail.assigned_name ?? ''} onChange={e => void updateTicket({ assigned_to: e.target.value || undefined } as Partial<Ticket>)}
                  style={{ fontSize: 11, padding: '4px 8px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 6, color: 'var(--t1)' }}>
                  <option value="">Ikke tildelt</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              {detail.status !== 'resolved' && (
                <button onClick={() => void updateTicket({ status: 'resolved' })}
                  style={{ width: '100%', background: 'var(--gr)', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  ✓ Marker som løst
                </button>
              )}
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 8 }}>Oprettet {timeAgo(detail.created_at)} siden</div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {detail.messages.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--t3)', textAlign: 'center', padding: '20px 0' }}>Ingen beskeder endnu</div>
              ) : (
                detail.messages.map(msg => (
                  <div key={msg.id} style={{
                    marginBottom: 10,
                    background: msg.is_internal ? 'rgba(245,158,11,0.08)' : !msg.author_id ? 'var(--s2)' : 'var(--bl2)',
                    border: `1px solid ${msg.is_internal ? 'rgba(245,158,11,0.2)' : 'var(--bd)'}`,
                    borderRadius: 8, padding: '10px 12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      {msg.is_internal && <span style={{ fontSize: 10 }}>🔒</span>}
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)' }}>{msg.author_name}</span>
                      {!msg.author_id && <span style={{ fontSize: 9, padding: '1px 5px', background: 'var(--s3)', borderRadius: 4, color: 'var(--t3)' }}>Kunde</span>}
                      {msg.is_internal && <span style={{ fontSize: 9, padding: '1px 5px', background: 'rgba(245,158,11,0.15)', borderRadius: 4, color: 'var(--ye)' }}>Intern</span>}
                      <span style={{ fontSize: 10, color: 'var(--t3)', marginLeft: 'auto' }}>{timeAgo(msg.created_at)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{msg.body}</div>
                  </div>
                ))
              )}
            </div>

            {/* Reply input */}
            <div style={{ flexShrink: 0, borderTop: '1px solid var(--bd)', padding: '12px 14px' }}>
              <div style={{ display: 'flex', gap: 0, marginBottom: 8, border: '1px solid var(--bd)', borderRadius: 6, overflow: 'hidden' }}>
                {[false, true].map(internal => (
                  <button key={String(internal)} onClick={() => setReplyInternal(internal)}
                    style={{ flex: 1, padding: '5px 0', fontSize: 11, border: 'none', cursor: 'pointer', fontWeight: replyInternal === internal ? 700 : 400, background: replyInternal === internal ? (internal ? 'rgba(245,158,11,0.15)' : 'var(--bl2)') : 'var(--s2)', color: replyInternal === internal ? (internal ? 'var(--ye)' : 'var(--bl)') : 'var(--t3)' }}>
                    {internal ? '🔒 Intern note' : 'Svar til kunde'}
                  </button>
                ))}
              </div>
              <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void sendReply(); }}
                placeholder={replyInternal ? 'Intern note — ikke synlig for kunden…' : 'Skriv en besked…'}
                rows={3} style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '7px 9px', background: replyInternal ? 'rgba(245,158,11,0.06)' : 'var(--s2)', border: `1px solid ${replyInternal ? 'rgba(245,158,11,0.2)' : 'var(--bd)'}`, borderRadius: 6, color: 'var(--t1)', resize: 'vertical', marginBottom: 6 }} />
              <button onClick={() => void sendReply()} disabled={!replyBody.trim() || sending}
                style={{ width: '100%', background: replyInternal ? 'var(--ye)' : 'var(--bl)', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: replyBody.trim() && !sending ? 1 : 0.5 }}>
                {sending ? 'Sender…' : replyInternal ? 'Tilføj note' : 'Send besked'}
              </button>
            </div>
          </div>
        )}
      </div>

      {showNew && <NewTicketModal customers={customers} onClose={() => setShowNew(false)} onCreated={() => { void loadTickets(); setShowNew(false); }} />}
      </>
      )}
    </div>
  );
}

function NewTicketModal({ customers, onClose, onCreated }: { customers: Customer[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ source: 'meridian', customer_id: '', subject: '', description: '', type: 'general', priority: 'normal' });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.subject.trim() || saving) return;
    setSaving(true);
    await fetch('/api/meridian/tickets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, customer_id: form.customer_id ? Number(form.customer_id) : undefined }),
    });
    setSaving(false);
    onCreated();
  }

  const s = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '22px 26px', width: 480 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 18 }}>Ny ticket</div>
        {[
          { label: 'Selskab', key: 'source', el: <select value={form.source} onChange={s('source')} style={inputStyle}><option value="meridian">Meridian</option><option value="creatorrate">CreatorRate</option></select> },
          { label: 'Kunde', key: 'customer_id', el: <select value={form.customer_id} onChange={s('customer_id')} style={inputStyle}><option value="">Vælg kunde…</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select> },
          { label: 'Emne *', key: 'subject', el: <input value={form.subject} onChange={s('subject')} placeholder="Kort beskrivelse…" style={inputStyle} /> },
          { label: 'Beskrivelse', key: 'description', el: <textarea value={form.description} onChange={s('description')} rows={3} placeholder="Detaljer…" style={{ ...inputStyle, resize: 'vertical' }} /> },
          { label: 'Type', key: 'type', el: <select value={form.type} onChange={s('type')} style={inputStyle}>{Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select> },
          { label: 'Prioritet', key: 'priority', el: <select value={form.priority} onChange={s('priority')} style={inputStyle}>{Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select> },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 3 }}>{f.label}</div>
            {f.el}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={() => void submit()} disabled={!form.subject.trim() || saving}
            style={{ flex: 1, background: 'var(--bl)', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? 'Opretter…' : 'Opret ticket'}
          </button>
          <button onClick={onClose} style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 13, color: 'var(--t2)', cursor: 'pointer' }}>Annuller</button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '7px 9px',
  background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 6, color: 'var(--t1)',
};
