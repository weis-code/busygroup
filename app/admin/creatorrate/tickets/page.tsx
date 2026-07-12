'use client';

import { useEffect, useState, useCallback } from 'react';

const CR = '#f43f5e';

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  open:        { label: 'Åben',    color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  in_progress: { label: 'I gang',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  resolved:    { label: 'Løst',    color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  closed:      { label: 'Lukket',  color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  low:    { label: 'Lav',    color: '#6b7280' },
  normal: { label: 'Normal', color: '#3b82f6' },
  high:   { label: 'Høj',   color: '#f59e0b' },
  urgent: { label: 'Akut',  color: '#ef4444' },
};

interface Ticket {
  id: number;
  type: 'dev' | 'support';
  status: string;
  priority: string;
  title: string;
  description: string | null;
  reporter_name: string | null;
  reporter_email: string | null;
  assignee_name: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

interface Comment {
  id: number;
  ticket_id: number;
  user_id: string | null;
  user_name: string;
  body: string;
  created_at: string;
}

const EMPTY_FORM = {
  type: 'support' as 'dev' | 'support',
  priority: 'normal',
  title: '',
  description: '',
  reporter_name: '',
  reporter_email: '',
};

export default function CreatorRateTicketsPage() {
  const [activeType, setActiveType]     = useState<'support' | 'dev'>('support');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [tickets, setTickets]           = useState<Ticket[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selected, setSelected]         = useState<Ticket | null>(null);
  const [showCreate, setShowCreate]     = useState(false);
  const [form, setForm]                 = useState({ ...EMPTY_FORM });
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState<string | null>(null);

  // Edit state
  const [editing, setEditing]           = useState(false);
  const [editForm, setEditForm]         = useState<Partial<typeof EMPTY_FORM & { title: string }>>({});
  const [editSaving, setEditSaving]     = useState(false);
  const [editError, setEditError]       = useState<string | null>(null);

  // Comments state
  const [comments, setComments]         = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentBody, setCommentBody]   = useState('');
  const [commentSaving, setCommentSaving] = useState(false);

  const STATUS_FLOW: string[] = ['open', 'in_progress', 'resolved', 'closed'];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: activeType });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const data = await fetch(`/api/creatorrate/tickets?${params}`).then(r => r.json()) as Ticket[];
      setTickets(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [activeType, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  async function loadComments(ticketId: number) {
    setCommentsLoading(true);
    try {
      const data = await fetch(`/api/creatorrate/tickets/${ticketId}/comments`).then(r => r.json()) as Comment[];
      setComments(Array.isArray(data) ? data : []);
    } finally {
      setCommentsLoading(false);
    }
  }

  function openDetail(ticket: Ticket) {
    setSelected(ticket);
    setEditing(false);
    setEditError(null);
    setCommentBody('');
    void loadComments(ticket.id);
  }

  async function createTicket() {
    if (!form.title) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/creatorrate/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.type,
          priority: form.priority,
          title: form.title,
          description: form.description || null,
          reporter_name: form.reporter_name || null,
          reporter_email: form.reporter_email || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setSaveError(body.error ?? `Fejl ${res.status}`);
        return;
      }
      setForm({ ...EMPTY_FORM });
      setShowCreate(false);
      setActiveType(form.type);
      setStatusFilter('open');
      await load();
    } catch {
      setSaveError('Netværksfejl — prøv igen');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: number, status: string) {
    await fetch(`/api/creatorrate/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setSelected(prev => prev ? { ...prev, status } : prev);
    await load();
  }

  function startEdit(ticket: Ticket) {
    setEditForm({
      title: ticket.title,
      description: ticket.description ?? '',
      priority: ticket.priority,
      reporter_name: ticket.reporter_name ?? '',
      reporter_email: ticket.reporter_email ?? '',
    });
    setEditError(null);
    setEditing(true);
  }

  async function saveEdit() {
    if (!selected || !editForm.title?.trim()) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/creatorrate/tickets/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description || null,
          priority: editForm.priority,
          reporter_name: editForm.reporter_name || null,
          reporter_email: editForm.reporter_email || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setEditError(body.error ?? `Fejl ${res.status}`);
        return;
      }
      const updated: Ticket = {
        ...selected,
        title: editForm.title ?? selected.title,
        description: editForm.description || null,
        priority: editForm.priority ?? selected.priority,
        reporter_name: editForm.reporter_name || null,
        reporter_email: editForm.reporter_email || null,
      };
      setSelected(updated);
      setEditing(false);
      await load();
    } catch {
      setEditError('Netværksfejl — prøv igen');
    } finally {
      setEditSaving(false);
    }
  }

  async function postComment() {
    if (!selected || !commentBody.trim()) return;
    setCommentSaving(true);
    try {
      const res = await fetch(`/api/creatorrate/tickets/${selected.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: commentBody }),
      });
      if (res.ok) {
        const comment = await res.json() as Comment;
        setComments(prev => [...prev, comment]);
        setCommentBody('');
      }
    } finally {
      setCommentSaving(false);
    }
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtDateTime(iso: string) {
    return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  const openCount   = tickets.filter(t => t.status === 'open').length;
  const inProgCount = tickets.filter(t => t.status === 'in_progress').length;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 980 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', margin: 0, marginBottom: 4 }}>Tickets</h1>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>
            CreatorRate · {openCount} åbne{inProgCount > 0 ? ` · ${inProgCount} i gang` : ''}
          </div>
        </div>
        <button
          onClick={() => { setForm({ ...EMPTY_FORM, type: activeType }); setShowCreate(true); }}
          style={{ background: CR, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          + Opret ticket
        </button>
      </div>

      {/* Type tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--s2)', borderRadius: 9, padding: 4, width: 'fit-content' }}>
        {(['support', 'dev'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveType(t)}
            style={{
              padding: '6px 16px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: activeType === t ? 'var(--s1)' : 'transparent',
              color: activeType === t ? 'var(--t1)' : 'var(--t3)',
              boxShadow: activeType === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {t === 'support' ? 'Support' : 'Udvikling'}
          </button>
        ))}
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
                padding: '4px 12px', borderRadius: 100, border: `1px solid ${active ? (meta?.color ?? CR) : 'var(--bd)'}`,
                background: active ? (meta?.bg ?? 'rgba(244,63,94,0.1)') : 'transparent',
                color: active ? (meta?.color ?? CR) : 'var(--t3)',
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
            <button onClick={() => setShowCreate(true)} style={{ color: CR, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              Opret den første →
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--s2)' }}>
                <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', width: 44 }}>#</th>
                <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Titel</th>
                {activeType === 'support' && (
                  <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Creator</th>
                )}
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
                    onClick={() => openDetail(t)}
                    style={{ borderTop: i > 0 ? '1px solid var(--bd)' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '11px 14px', color: 'var(--t3)', fontSize: 12 }}>#{t.id}</td>
                    <td style={{ padding: '11px 14px', color: 'var(--t1)', fontWeight: 500, maxWidth: 360 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                    </td>
                    {activeType === 'support' && (
                      <td style={{ padding: '11px 14px', color: 'var(--t3)' }}>
                        {t.reporter_name ?? '—'}
                      </td>
                    )}
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

      {/* Ticket detail modal */}
      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) { setSelected(null); setEditing(false); } }}
        >
          <div style={{ background: 'var(--s1)', borderRadius: 14, padding: 28, width: 580, maxWidth: '94vw', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  #{selected.id} · {selected.type === 'dev' ? 'Udvikling' : 'Support'}
                </div>
                {!editing && (
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>{selected.title}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginLeft: 12, flexShrink: 0 }}>
                {!editing && (
                  <button
                    onClick={() => startEdit(selected)}
                    style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '5px 12px', fontSize: 12, color: 'var(--t2)', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Rediger
                  </button>
                )}
                <button onClick={() => { setSelected(null); setEditing(false); }} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 4px' }}>×</button>
              </div>
            </div>

            {/* Edit form */}
            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Titel *</label>
                  <input
                    value={editForm.title ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                    autoFocus
                    style={{ width: '100%', marginTop: 4 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Beskrivelse</label>
                  <textarea
                    value={editForm.description ?? ''}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    rows={3}
                    style={{ width: '100%', marginTop: 4, resize: 'vertical' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Prioritet</label>
                  <select
                    value={editForm.priority ?? 'normal'}
                    onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}
                    style={{ width: '100%', marginTop: 4 }}
                  >
                    <option value="low">Lav</option>
                    <option value="normal">Normal</option>
                    <option value="high">Høj</option>
                    <option value="urgent">Akut</option>
                  </select>
                </div>
                {selected.type === 'support' && (
                  <>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Creator navn</label>
                      <input
                        value={editForm.reporter_name ?? ''}
                        onChange={e => setEditForm(f => ({ ...f, reporter_name: e.target.value }))}
                        style={{ width: '100%', marginTop: 4 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Creator email</label>
                      <input
                        value={editForm.reporter_email ?? ''}
                        onChange={e => setEditForm(f => ({ ...f, reporter_email: e.target.value }))}
                        type="email"
                        style={{ width: '100%', marginTop: 4 }}
                      />
                    </div>
                  </>
                )}
                {editError && (
                  <div style={{ padding: '8px 12px', background: 'var(--re2)', borderRadius: 7, fontSize: 12, color: 'var(--re)' }}>{editError}</div>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => { setEditing(false); setEditError(null); }}
                    style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '7px 14px', fontSize: 12 }}
                  >
                    Annuller
                  </button>
                  <button
                    onClick={() => void saveEdit()}
                    disabled={!editForm.title?.trim() || editSaving}
                    style={{ background: CR, color: '#fff', border: 'none', borderRadius: 7, padding: '7px 16px', fontSize: 12, fontWeight: 600, opacity: editSaving ? 0.7 : 1, cursor: editSaving ? 'default' : 'pointer' }}
                  >
                    {editSaving ? 'Gemmer…' : 'Gem ændringer'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Description */}
                {selected.description && (
                  <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, padding: '12px 14px', background: 'var(--s2)', borderRadius: 8 }}>
                    {selected.description}
                  </div>
                )}

                {/* Meta grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                  {selected.reporter_name && (
                    <div>
                      <div style={{ color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, marginBottom: 3 }}>Creator</div>
                      <div style={{ color: 'var(--t1)' }}>{selected.reporter_name}</div>
                      {selected.reporter_email && <div style={{ color: 'var(--t3)' }}>{selected.reporter_email}</div>}
                    </div>
                  )}
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

                {/* Status change */}
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
              </>
            )}

            {/* Comments */}
            {!editing && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  Kommentarer {comments.length > 0 && `(${comments.length})`}
                </div>

                {commentsLoading ? (
                  <div style={{ fontSize: 12, color: 'var(--t3)', padding: '8px 0' }}>Henter kommentarer…</div>
                ) : comments.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--t3)', padding: '8px 0' }}>Ingen kommentarer endnu.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {comments.map(c => (
                      <div key={c.id} style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{c.user_name}</span>
                          <span style={{ fontSize: 11, color: 'var(--t3)' }}>{fmtDateTime(c.created_at)}</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.body}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add comment */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <textarea
                    value={commentBody}
                    onChange={e => setCommentBody(e.target.value)}
                    placeholder="Skriv en kommentar…"
                    rows={2}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        void postComment();
                      }
                    }}
                    style={{ flex: 1, resize: 'none', fontSize: 13 }}
                  />
                  <button
                    onClick={() => void postComment()}
                    disabled={!commentBody.trim() || commentSaving}
                    style={{
                      background: CR, color: '#fff', border: 'none', borderRadius: 7,
                      padding: '8px 14px', fontSize: 12, fontWeight: 600,
                      opacity: !commentBody.trim() || commentSaving ? 0.5 : 1,
                      cursor: !commentBody.trim() || commentSaving ? 'default' : 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {commentSaving ? '…' : 'Send'}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>⌘+Enter for at sende</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create ticket modal */}
      {showCreate && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowCreate(false); setSaveError(null); } }}
        >
          <div style={{ background: 'var(--s1)', borderRadius: 14, padding: 28, width: 460, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 20 }}>Opret ticket</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Type */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</label>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  {(['support', 'dev'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setForm(f => ({ ...f, type: t }))}
                      style={{
                        flex: 1, padding: '8px', borderRadius: 7, border: `1px solid ${form.type === t ? CR : 'var(--bd)'}`,
                        background: form.type === t ? 'rgba(244,63,94,0.08)' : 'var(--s2)',
                        color: form.type === t ? CR : 'var(--t3)',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {t === 'support' ? 'Support' : 'Udvikling'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Titel *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Beskriv problemet kort"
                  autoFocus
                  style={{ width: '100%', marginTop: 4 }}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Beskrivelse</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Uddyb hvad der sker…"
                  rows={3}
                  style={{ width: '100%', marginTop: 4, resize: 'vertical' }}
                />
              </div>

              {/* Priority */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Prioritet</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={{ width: '100%', marginTop: 4 }}>
                  <option value="low">Lav</option>
                  <option value="normal">Normal</option>
                  <option value="high">Høj</option>
                  <option value="urgent">Akut</option>
                </select>
              </div>

              {/* Reporter (support only) */}
              {form.type === 'support' && (
                <>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Creator navn</label>
                    <input
                      value={form.reporter_name}
                      onChange={e => setForm(f => ({ ...f, reporter_name: e.target.value }))}
                      placeholder="Navn på creator"
                      style={{ width: '100%', marginTop: 4 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Creator email</label>
                    <input
                      value={form.reporter_email}
                      onChange={e => setForm(f => ({ ...f, reporter_email: e.target.value }))}
                      placeholder="email@example.com"
                      type="email"
                      style={{ width: '100%', marginTop: 4 }}
                    />
                  </div>
                </>
              )}
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
                style={{ background: CR, color: '#fff', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600, opacity: saving ? 0.7 : 1, cursor: saving ? 'default' : 'pointer' }}
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
