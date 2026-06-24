'use client';

import { useEffect, useState } from 'react';

interface Comment  { id: string; body: string; user_name: string; created_at: string }
interface Followup {
  id: string; title: string; body: string | null; status: string;
  created_at: string; resolved_at: string | null;
  created_by_name: string; assigned_to_name: string | null; assigned_to: string | null;
  seller_name: string | null; sitrep_date: string | null; sitrep_id: string | null;
  followup_count?: number;
  comments: Comment[];
}
interface AdminUser { id: string; name: string }

const STATUS_CLR: Record<string, string> = { OPEN: 'var(--re)', IN_PROGRESS: 'var(--ye)', RESOLVED: 'var(--gr)' };
const STATUS_BG:  Record<string, string> = { OPEN: 'var(--re2)', IN_PROGRESS: 'var(--ye2)', RESOLVED: 'var(--gr2)' };

const fmtDate = (ts: string) => new Date(ts).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
const fmtTime = (ts: string) => new Date(ts).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });

export default function FollowupsPage() {
  const [followups, setFollowups]   = useState<Followup[]>([]);
  const [users, setUsers]           = useState<AdminUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [addingComment, setAddingComment] = useState<string | null>(null);
  const [newModal, setNewModal]     = useState(false);
  const [newForm, setNewForm]       = useState({ title: '', body: '', assigned_to: '' });
  const [savingNew, setSavingNew]   = useState(false);

  async function load() {
    const d = await fetch('/api/followups').then(r => r.json()) as { followups: Followup[]; users: AdminUser[] };
    setFollowups(d.followups ?? []);
    setUsers(d.users ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: string) {
    await fetch(`/api/followups/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    await load();
  }

  async function setAssigned(id: string, assigned_to: string | null) {
    await fetch(`/api/followups/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assigned_to }) });
    await load();
  }

  async function addComment(followupId: string) {
    const body = commentText[followupId]?.trim();
    if (!body) return;
    setAddingComment(followupId);
    await fetch(`/api/followups/${followupId}/comment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
    setCommentText(t => ({ ...t, [followupId]: '' }));
    setAddingComment(null);
    await load();
  }

  async function createNew() {
    if (!newForm.title.trim()) return;
    setSavingNew(true);
    await fetch('/api/followups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newForm.title, body: newForm.body || null, assigned_to: newForm.assigned_to || null }) });
    setNewModal(false);
    setNewForm({ title: '', body: '', assigned_to: '' });
    setSavingNew(false);
    await load();
  }

  const filtered = followups.filter(f =>
    statusFilter === 'ACTIVE' ? f.status !== 'RESOLVED' :
    statusFilter === 'ALL'    ? true : f.status === statusFilter
  );

  const openCount       = followups.filter(f => f.status === 'OPEN').length;
  const inProgressCount = followups.filter(f => f.status === 'IN_PROGRESS').length;
  const resolvedCount   = followups.filter(f => f.status === 'RESOLVED').length;

  if (loading) return <div style={{ padding: 40, color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 860 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Follow-up board</h1>
          <p className="page-sub">Tracker og opfølgning på sælgernes behov</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/admin/sitreps" className="btn btn-ghost btn-sm">← Sitrep feed</a>
          <button onClick={() => setNewModal(true)} className="btn btn-primary">+ Nyt follow-up</button>
        </div>
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Åbne',   count: openCount,       color: 'var(--re)', bg: 'var(--re2)', filter: 'OPEN' },
          { label: 'I gang', count: inProgressCount, color: 'var(--ye)', bg: 'var(--ye2)', filter: 'IN_PROGRESS' },
          { label: 'Løst',   count: resolvedCount,   color: 'var(--gr)', bg: 'var(--gr2)', filter: 'RESOLVED' },
        ].map(k => (
          <button key={k.filter} onClick={() => setStatusFilter(statusFilter === k.filter ? 'ACTIVE' : k.filter)} style={{
            background: statusFilter === k.filter ? k.bg : 'var(--s1)',
            border: `1px solid ${statusFilter === k.filter ? k.color : 'var(--bd)'}`,
            borderRadius: 10, padding: '16px 20px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
          }}>
            <div className="kpi-label">{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: k.color, fontVariantNumeric: 'tabular-nums' }}>{k.count}</div>
          </button>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {[['ACTIVE','Aktive'],['ALL','Alle'],['OPEN','Åbne'],['IN_PROGRESS','I gang'],['RESOLVED','Løste']].map(([val, label]) => (
          <button key={val} onClick={() => setStatusFilter(val)} style={{
            background: statusFilter === val ? 'var(--bl)' : 'var(--bd)', color: statusFilter === val ? '#fff' : 'var(--t2)',
            border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>{label}</button>
        ))}
      </div>

      {filtered.length === 0 && <div style={{ color: 'var(--t3)', fontSize: 13 }}>Ingen follow-ups at vise</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(f => {
          const isExpanded = expanded === f.id;
          return (
            <div key={f.id} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden' }}>
              <div onClick={() => setExpanded(isExpanded ? null : f.id)} style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_CLR[f.status], flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                    {fmtDate(f.created_at)} · {f.created_by_name}
                    {f.seller_name && ` · Fra: ${f.seller_name}`}
                    {f.comments.length > 0 && ` · ${f.comments.length} kommentar${f.comments.length !== 1 ? 'er' : ''}`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {f.assigned_to_name && (
                    <span style={{ fontSize: 11, color: 'var(--t3)', background: 'var(--bd)', borderRadius: 4, padding: '2px 8px' }}>{f.assigned_to_name}</span>
                  )}
                  <select
                    value={f.status}
                    onClick={e => e.stopPropagation()}
                    onChange={e => setStatus(f.id, e.target.value)}
                    style={{ background: STATUS_BG[f.status], border: `1px solid ${STATUS_CLR[f.status]}55`, color: STATUS_CLR[f.status], borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 700, width: 'auto' }}
                  >
                    <option value="OPEN">Åben</option>
                    <option value="IN_PROGRESS">I gang</option>
                    <option value="RESOLVED">Løst</option>
                  </select>
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ color: 'var(--t4)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>

              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--bd)', padding: '16px 18px' }}>
                  {f.body && <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 16, whiteSpace: 'pre-wrap' }}>{f.body}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <span style={{ fontSize: 11, color: 'var(--t3)' }}>Ansvarlig:</span>
                    <select value={f.assigned_to ?? ''} onChange={e => setAssigned(f.id, e.target.value || null)} style={{ background: 'var(--s2)', border: '1px solid var(--bd2)', color: 'var(--t1)', borderRadius: 6, padding: '4px 8px', fontSize: 12, width: 'auto' }}>
                      <option value="">Ingen</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    {f.status === 'RESOLVED' && f.resolved_at && (
                      <span style={{ fontSize: 11, color: 'var(--gr)', marginLeft: 'auto' }}>Løst {fmtDate(f.resolved_at)} kl. {fmtTime(f.resolved_at)}</span>
                    )}
                  </div>
                  {f.comments.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      {f.comments.map(c => (
                        <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bl2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--bl)', flexShrink: 0, fontWeight: 700 }}>
                            {c.user_name.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 2 }}>{c.user_name} · {fmtDate(c.created_at)} {fmtTime(c.created_at)}</div>
                            <div style={{ fontSize: 13, color: 'var(--t1)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.body}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text" placeholder="Tilføj kommentar…"
                      value={commentText[f.id] ?? ''}
                      onChange={e => setCommentText(t => ({ ...t, [f.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addComment(f.id)}
                    />
                    <button onClick={() => addComment(f.id)} disabled={addingComment === f.id || !commentText[f.id]?.trim()} className="btn btn-primary" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>Send</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {newModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-title">Nyt follow-up</div>
            <div className="modal-form">
              <div className="form-group">
                <label>Titel *</label>
                <input type="text" value={newForm.title} onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))} placeholder="Hvad skal følges op på?" />
              </div>
              <div className="form-group">
                <label>Beskrivelse</label>
                <textarea value={newForm.body} onChange={e => setNewForm(f => ({ ...f, body: e.target.value }))} rows={3} placeholder="Yderligere detaljer…" />
              </div>
              <div className="form-group">
                <label>Ansvarlig</label>
                <select value={newForm.assigned_to} onChange={e => setNewForm(f => ({ ...f, assigned_to: e.target.value }))} style={{ width: 'auto' }}>
                  <option value="">Ingen</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="modal-footer">
                <button onClick={() => setNewModal(false)} className="btn btn-ghost" style={{ flex: 1 }}>Annuller</button>
                <button onClick={createNew} disabled={savingNew || !newForm.title.trim()} className="btn btn-primary" style={{ flex: 2 }}>
                  {savingNew ? 'Opretter…' : 'Opret'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
