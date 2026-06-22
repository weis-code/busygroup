'use client';

import { useEffect, useState } from 'react';

interface Comment { id: string; body: string; user_name: string; created_at: string }
interface Followup {
  id: string; title: string; body: string | null; status: string;
  created_at: string; resolved_at: string | null;
  created_by_name: string; assigned_to_name: string | null; assigned_to: string | null;
  seller_name: string | null; sitrep_date: string | null; sitrep_id: string | null;
  followup_count?: number;
  comments: Comment[];
}
interface AdminUser { id: string; name: string }

const STATUS_COLOR: Record<string, string> = { OPEN: '#E74C3C', IN_PROGRESS: '#F39C12', RESOLVED: '#2ECC71' };

const fmtDate = (ts: string) => new Date(ts).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
const fmtTime = (ts: string) => new Date(ts).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });

export default function FollowupsPage() {
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [addingComment, setAddingComment] = useState<string | null>(null);
  const [newModal, setNewModal] = useState(false);
  const [newForm, setNewForm] = useState({ title: '', body: '', assigned_to: '' });
  const [savingNew, setSavingNew] = useState(false);

  async function load() {
    const d = await fetch('/api/followups').then(r => r.json()) as { followups: Followup[]; users: AdminUser[] };
    setFollowups(d.followups ?? []);
    setUsers(d.users ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: string) {
    await fetch(`/api/followups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function setAssigned(id: string, assigned_to: string | null) {
    await fetch(`/api/followups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to }),
    });
    await load();
  }

  async function addComment(followupId: string) {
    const body = commentText[followupId]?.trim();
    if (!body) return;
    setAddingComment(followupId);
    await fetch(`/api/followups/${followupId}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    setCommentText(t => ({ ...t, [followupId]: '' }));
    setAddingComment(null);
    await load();
  }

  async function createNew() {
    if (!newForm.title.trim()) return;
    setSavingNew(true);
    await fetch('/api/followups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newForm.title, body: newForm.body || null, assigned_to: newForm.assigned_to || null }),
    });
    setNewModal(false);
    setNewForm({ title: '', body: '', assigned_to: '' });
    setSavingNew(false);
    await load();
  }

  const filtered = followups.filter(f =>
    statusFilter === 'ACTIVE' ? f.status !== 'RESOLVED' :
    statusFilter === 'ALL' ? true : f.status === statusFilter
  );

  const openCount = followups.filter(f => f.status === 'OPEN').length;
  const inProgressCount = followups.filter(f => f.status === 'IN_PROGRESS').length;
  const resolvedCount = followups.filter(f => f.status === 'RESOLVED').length;

  if (loading) return <div style={{ padding: 40, color: '#667788', fontSize: 13 }}>Indlæser…</div>;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 4 }}>Follow-up board</h1>
          <div style={{ fontSize: 12, color: '#667788' }}>Tracker og opfølgning på sælgernes behov</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/admin/sitreps" style={{ background: 'rgba(255,255,255,0.05)', color: '#667788', borderRadius: 7, padding: '8px 14px', fontSize: 12, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.08)' }}>
            ← Sitrep feed
          </a>
          <button
            onClick={() => setNewModal(true)}
            style={{ background: '#185FA5', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            + Nyt follow-up
          </button>
        </div>
      </div>

      {/* Status KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'ÅBNE', count: openCount, color: '#E74C3C', filter: 'OPEN' },
          { label: 'I GANG', count: inProgressCount, color: '#F39C12', filter: 'IN_PROGRESS' },
          { label: 'LØST', count: resolvedCount, color: '#2ECC71', filter: 'RESOLVED' },
        ].map(k => (
          <button
            key={k.filter}
            onClick={() => setStatusFilter(statusFilter === k.filter ? 'ACTIVE' : k.filter)}
            style={{
              background: statusFilter === k.filter ? `${k.color}18` : '#111E2A',
              border: `1px solid ${statusFilter === k.filter ? k.color + '44' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 10, padding: '16px 20px', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ fontSize: 10, color: '#667788', letterSpacing: '0.06em', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: k.color, fontVariantNumeric: 'tabular-nums' }}>{k.count}</div>
          </button>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['ACTIVE', 'Aktive'], ['ALL', 'Alle'], ['OPEN', 'Åbne'], ['IN_PROGRESS', 'I gang'], ['RESOLVED', 'Løste']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setStatusFilter(val)}
            style={{
              background: statusFilter === val ? '#185FA5' : 'rgba(255,255,255,0.05)',
              color: statusFilter === val ? '#fff' : '#667788',
              border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 && (
        <div style={{ color: '#667788', fontSize: 13 }}>Ingen follow-ups at vise</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(f => {
          const isExpanded = expanded === f.id;
          return (
            <div key={f.id} style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
              {/* Summary row */}
              <div
                onClick={() => setExpanded(isExpanded ? null : f.id)}
                style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[f.status], flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#ECF0F1', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.title}</div>
                  <div style={{ fontSize: 11, color: '#667788' }}>
                    Oprettet {fmtDate(f.created_at)} af {f.created_by_name}
                    {f.seller_name && ` · Fra: ${f.seller_name}`}
                    {f.sitrep_date && ` (${new Date(f.sitrep_date + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })})`}
                    {f.comments.length > 0 && ` · ${f.comments.length} kommentar${f.comments.length !== 1 ? 'er' : ''}`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {f.assigned_to_name && (
                    <div style={{ fontSize: 11, color: '#667788', background: 'rgba(255,255,255,0.05)', borderRadius: 4, padding: '3px 8px' }}>{f.assigned_to_name}</div>
                  )}
                  <select
                    value={f.status}
                    onClick={e => e.stopPropagation()}
                    onChange={e => setStatus(f.id, e.target.value)}
                    style={{
                      background: `${STATUS_COLOR[f.status]}18`, border: `1px solid ${STATUS_COLOR[f.status]}44`,
                      color: STATUS_COLOR[f.status], borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 600,
                    }}
                  >
                    <option value="OPEN">Åben</option>
                    <option value="IN_PROGRESS">I gang</option>
                    <option value="RESOLVED">Løst</option>
                  </select>
                  <span style={{ fontSize: 12, color: '#334455' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Expanded */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px 20px' }}>
                  {f.body && (
                    <div style={{ fontSize: 13, color: '#B0BEC5', lineHeight: 1.6, marginBottom: 16, whiteSpace: 'pre-wrap' }}>{f.body}</div>
                  )}

                  {/* Assign */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <span style={{ fontSize: 11, color: '#667788' }}>Ansvarlig:</span>
                    <select
                      value={f.assigned_to ?? ''}
                      onChange={e => setAssigned(f.id, e.target.value || null)}
                      style={{ background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)', color: '#ECF0F1', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}
                    >
                      <option value="">Ingen</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    {f.status === 'RESOLVED' && f.resolved_at && (
                      <span style={{ fontSize: 11, color: '#2ECC71', marginLeft: 'auto' }}>Løst {fmtDate(f.resolved_at)} kl. {fmtTime(f.resolved_at)}</span>
                    )}
                  </div>

                  {/* Comments */}
                  {f.comments.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      {f.comments.map(c => (
                        <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#185FA522', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#185FA5', flexShrink: 0, fontWeight: 700 }}>
                            {c.user_name.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: '#667788', marginBottom: 2 }}>{c.user_name} · {fmtDate(c.created_at)} {fmtTime(c.created_at)}</div>
                            <div style={{ fontSize: 13, color: '#ECF0F1', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.body}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add comment */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Tilføj kommentar…"
                      value={commentText[f.id] ?? ''}
                      onChange={e => setCommentText(t => ({ ...t, [f.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addComment(f.id)}
                      style={{ flex: 1, background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#ECF0F1', fontSize: 12, padding: '7px 10px' }}
                    />
                    <button
                      onClick={() => addComment(f.id)}
                      disabled={addingComment === f.id || !commentText[f.id]?.trim()}
                      style={{ background: '#185FA5', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 12, cursor: 'pointer', opacity: addingComment === f.id ? 0.6 : 1 }}
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New follow-up modal */}
      {newModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80 }}>
          <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '28px 32px', width: 480, maxWidth: '90vw' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#ECF0F1', marginBottom: 20 }}>Nyt follow-up</div>

            <label style={{ display: 'block', fontSize: 12, color: '#667788', marginBottom: 5 }}>Titel *</label>
            <input
              type="text"
              value={newForm.title}
              onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Hvad skal følges op på?"
              style={{ width: '100%', background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#ECF0F1', fontSize: 13, padding: '9px 12px', marginBottom: 14, boxSizing: 'border-box' }}
            />

            <label style={{ display: 'block', fontSize: 12, color: '#667788', marginBottom: 5 }}>Beskrivelse</label>
            <textarea
              value={newForm.body}
              onChange={e => setNewForm(f => ({ ...f, body: e.target.value }))}
              rows={3}
              placeholder="Yderligere detaljer…"
              style={{ width: '100%', background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#ECF0F1', fontSize: 13, padding: '9px 12px', marginBottom: 14, boxSizing: 'border-box', resize: 'vertical' }}
            />

            <label style={{ display: 'block', fontSize: 12, color: '#667788', marginBottom: 5 }}>Ansvarlig</label>
            <select
              value={newForm.assigned_to}
              onChange={e => setNewForm(f => ({ ...f, assigned_to: e.target.value }))}
              style={{ width: '100%', background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#ECF0F1', fontSize: 13, padding: '9px 12px', marginBottom: 20, boxSizing: 'border-box' }}
            >
              <option value="">Ingen</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setNewModal(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#667788', borderRadius: 7, padding: '8px 18px', fontSize: 13, cursor: 'pointer' }}>Annuller</button>
              <button
                onClick={createNew}
                disabled={savingNew || !newForm.title.trim()}
                style={{ background: '#185FA5', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: savingNew ? 0.7 : 1 }}
              >
                {savingNew ? 'Opretter…' : 'Opret'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
