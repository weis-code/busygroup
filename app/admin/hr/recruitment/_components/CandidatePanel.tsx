'use client';

import { useEffect, useRef, useState } from 'react';
import {
  STAGES, FUNNEL_STAGES, INTERVIEW_FORMATS, stageConfig, sourceLabel,
  fmtDateLong, fmtDateShort, fmtDatetime, daysUntil, timeAgo, initials, avatarColor,
} from '@/lib/recruitment';
import type { CandidateDetail, Comment, ChecklistItem, Company, UserOption, ChecklistTemplate } from './types';

const SAMTALE_STAGES = FUNNEL_STAGES.slice(FUNNEL_STAGES.indexOf('samtale_booket'));

export default function CandidatePanel({ candidate, companies, users, onClose, onUpdated, onDeleted, onEdit, onToast }: {
  candidate: CandidateDetail;
  companies: Company[];
  users: UserOption[];
  onClose: () => void;
  onUpdated: () => Promise<void>;
  onDeleted: () => void;
  onEdit: () => void;
  onToast: (m: string) => void;
}) {
  const [comments, setComments] = useState<Comment[]>(candidate.comments ?? []);
  const [commentDraft, setDraft] = useState('');
  const [sendingComment, setSending] = useState(false);
  const [editingCommentId, setEditingComment] = useState<number | null>(null);
  const [editBody, setEditBody] = useState('');
  const [notes, setNotes] = useState(candidate.notes ?? '');
  const [interviewDate, setInterviewDate] = useState(candidate.interview_date ? candidate.interview_date.slice(0, 16) : '');
  const [interviewFormat, setInterviewFormat] = useState(candidate.interview_format ?? '');
  const [startDate, setStartDate] = useState(candidate.start_date ?? '');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(candidate.checklist ?? []);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setComments(candidate.comments ?? []);
    setNotes(candidate.notes ?? '');
    setInterviewDate(candidate.interview_date ? candidate.interview_date.slice(0, 16) : '');
    setInterviewFormat(candidate.interview_format ?? '');
    setStartDate(candidate.start_date ?? '');
    setChecklist(candidate.checklist ?? []);
  }, [candidate]);

  useEffect(() => {
    if (candidate.stage === 'ansat') {
      fetch('/api/hr/checklist-templates').then(r => r.json()).then(setTemplates).catch(() => void 0);
    }
  }, [candidate.stage]);

  async function patchCandidate(body: Record<string, unknown>) {
    await fetch(`/api/hr/candidates/${candidate.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    await onUpdated();
  }

  async function changeStage(newStage: string) {
    let rejection_reason: string | null | undefined;
    if (newStage === 'stoppet') rejection_reason = window.prompt('Årsag til stop? (valgfrit)') ?? '';
    await fetch(`/api/hr/candidates/${candidate.id}/stage`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage, rejection_reason }),
    });
    await onUpdated();
  }

  async function sendComment() {
    if (!commentDraft.trim()) return;
    setSending(true);
    const res = await fetch(`/api/hr/candidates/${candidate.id}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: commentDraft.trim() }),
    });
    const c = await res.json() as Comment;
    setComments(prev => [...prev, c]);
    setDraft('');
    setSending(false);
    setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  async function deleteComment(commentId: number) {
    await fetch(`/api/hr/candidates/${candidate.id}/comments/${commentId}`, { method: 'DELETE' });
    setComments(prev => prev.filter(c => c.id !== commentId));
  }

  async function saveEditComment(commentId: number) {
    if (!editBody.trim()) return;
    const res = await fetch(`/api/hr/candidates/${candidate.id}/comments/${commentId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: editBody.trim() }),
    });
    const updated = await res.json() as Comment;
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, body: updated.body } : c));
    setEditingComment(null);
  }

  async function deleteCandidate() {
    if (!confirm(`Slet ${candidate.full_name}?`)) return;
    await fetch(`/api/hr/candidates/${candidate.id}`, { method: 'DELETE' });
    onDeleted();
    onToast('Kandidat slettet');
  }

  async function toggleChecklistItem(item: ChecklistItem) {
    setChecklist(prev => prev.map(i => i.id === item.id ? { ...i, is_completed: !i.is_completed } : i));
    await fetch(`/api/hr/candidates/${candidate.id}/checklist/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_completed: !item.is_completed }),
    });
    await onUpdated();
  }

  async function deleteChecklistItem(itemId: number) {
    setChecklist(prev => prev.filter(i => i.id !== itemId));
    await fetch(`/api/hr/candidates/${candidate.id}/checklist/${itemId}`, { method: 'DELETE' });
    await onUpdated();
  }

  async function addChecklistItem() {
    if (!newTaskTitle.trim()) return;
    const res = await fetch(`/api/hr/candidates/${candidate.id}/checklist`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTaskTitle.trim() }),
    });
    const item = await res.json() as ChecklistItem;
    setChecklist(prev => [...prev, item]);
    setNewTaskTitle('');
    await onUpdated();
  }

  async function applyTemplate(templateId: number) {
    const res = await fetch(`/api/hr/candidates/${candidate.id}/checklist/apply-template`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template_id: templateId }),
    });
    if (!res.ok) { const d = await res.json() as { error?: string }; onToast(d.error ?? 'Fejl'); return; }
    const items = await res.json() as ChecklistItem[];
    setChecklist(prev => [...prev, ...items]);
    await onUpdated();
  }

  const stage = stageConfig(candidate.stage);
  const startDays = daysUntil(candidate.start_date);
  const sortedChecklist = [...checklist].sort((a, b) => (a.is_completed === b.is_completed ? a.position - b.position : a.is_completed ? 1 : -1));
  const checklistDone = checklist.filter(i => i.is_completed).length;

  return (
    <div style={{ width: 420, flexShrink: 0, borderLeft: '1px solid var(--bd)', background: 'var(--s1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 18, cursor: 'pointer', padding: 0 }}>×</button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onEdit} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Rediger</button>
            <button onClick={() => void deleteCandidate()} style={{ background: 'var(--re2)', color: 'var(--re)', border: '1px solid var(--re)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Slet</button>
          </div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>{candidate.full_name}</div>
        <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>
          {candidate.applying_for}
          {candidate.company_name && <span style={{ color: candidate.company_color ?? 'var(--t3)' }}> · {candidate.company_name}</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={candidate.stage} onChange={e => void changeStage(e.target.value)}
            style={{ fontSize: 11, fontWeight: 700, color: stage?.color ?? 'var(--t2)', background: `${stage?.color ?? 'var(--t2)'}18`, border: `1px solid ${stage?.color ?? 'var(--bd)'}`, borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>
            {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select value={candidate.assigned_to ?? ''} onChange={e => void patchCandidate({ assigned_to: e.target.value || null })}
            style={{ fontSize: 11, color: 'var(--t2)', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 5, padding: '2px 8px' }}>
            <option value="">— Ikke tildelt —</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* NØGLEINFO */}
        <Section title="NØGLEINFO">
          <InfoRow label="Email" value={candidate.email ? <a href={`mailto:${candidate.email}`} style={{ color: 'var(--bl)' }}>{candidate.email}</a> : '—'} />
          <InfoRow label="Telefon" value={candidate.phone ? <a href={`tel:${candidate.phone}`} style={{ color: 'var(--bl)' }}>{candidate.phone}</a> : '—'} />
          <InfoRow label="LinkedIn" value={candidate.linkedin ? <a href={candidate.linkedin} target="_blank" rel="noreferrer" style={{ color: 'var(--bl)' }}>Profil</a> : '—'} />
          <InfoRow label="Kilde" value={sourceLabel(candidate.source)} />
          <InfoRow label="Lokation" value={candidate.location ?? '—'} />
          <InfoRow label="Lønforventning" value={candidate.salary_expectation ?? '—'} />
          <InfoRow label="Ansøgt" value={candidate.applied_at ? fmtDateLong(candidate.applied_at) : '—'} />
        </Section>

        {/* OPSTART */}
        {candidate.stage === 'ansat' && (
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bd)' }}>
            <div style={{ background: 'var(--gr2)', border: '1px solid var(--gr)', borderRadius: 9, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gr)', marginBottom: 4 }}>
                🗓 Opstartsdato: {candidate.start_date ? fmtDateLong(candidate.start_date) : 'Ikke sat'}
              </div>
              {startDays !== null && (
                <div style={{ fontSize: 11, color: 'var(--gr)', opacity: 0.85, marginBottom: 8 }}>
                  {startDays >= 0 ? `Om ${startDays} ${startDays === 1 ? 'dag' : 'dage'}` : `${Math.abs(startDays)} dage siden`}
                </div>
              )}
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                onBlur={() => void patchCandidate({ start_date: startDate || null })}
                style={{ fontSize: 11, width: 150 }} />
            </div>
          </div>
        )}

        {/* SAMTALE */}
        {SAMTALE_STAGES.includes(candidate.stage) && (
          <Section title="SAMTALE">
            <InfoRow label="Dato" value={
              <input type="datetime-local" value={interviewDate} onChange={e => setInterviewDate(e.target.value)}
                onBlur={() => void patchCandidate({ interview_date: interviewDate || null })}
                style={{ fontSize: 11, width: 170 }} />
            } />
            <InfoRow label="Format" value={
              <select value={interviewFormat} onChange={e => { setInterviewFormat(e.target.value); void patchCandidate({ interview_format: e.target.value || null }); }}
                style={{ fontSize: 11, width: 170 }}>
                <option value="">— Vælg —</option>
                {INTERVIEW_FORMATS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            } />
          </Section>
        )}

        {/* TJEKLISTE */}
        {candidate.stage === 'ansat' && (
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bd)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 8 }}>Opgaver inden opstart</div>
            {checklist.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 6 }}>{checklistDone} af {checklist.length} opgaver fuldført</div>
                <div style={{ height: 5, borderRadius: 3, background: 'var(--s3)', overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{ height: '100%', width: `${checklist.length ? (checklistDone / checklist.length) * 100 : 0}%`, background: 'var(--gr)' }} />
                </div>
              </>
            )}
            {checklist.length === 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 8 }}>Ingen opgaver endnu</div>
                {templates.length > 0 && (
                  <select defaultValue="" onChange={e => { if (e.target.value) void applyTemplate(Number(e.target.value)); }}
                    style={{ fontSize: 11, width: '100%' }}>
                    <option value="">+ Tilføj opgaver fra skabelon</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.item_count})</option>)}
                  </select>
                )}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {sortedChecklist.map(item => {
                const overdue = item.due_date && !item.is_completed && new Date(item.due_date) < new Date(new Date().toDateString());
                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0' }}>
                    <input type="checkbox" checked={item.is_completed} onChange={() => void toggleChecklistItem(item)} style={{ marginTop: 2, cursor: 'pointer' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: item.is_completed ? 'var(--t3)' : 'var(--t1)', textDecoration: item.is_completed ? 'line-through' : 'none' }}>{item.title}</div>
                      {item.due_date && !item.is_completed && (
                        <div style={{ fontSize: 10, color: overdue ? 'var(--re)' : 'var(--t3)' }}>Frist: {fmtDateShort(item.due_date)}</div>
                      )}
                      {item.is_completed && item.completed_at && (
                        <div style={{ fontSize: 10, color: 'var(--t3)' }}>{item.completed_by_name ?? ''} {timeAgo(item.completed_at)}</div>
                      )}
                    </div>
                    <button onClick={() => void deleteChecklistItem(item.id)} style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 12, cursor: 'pointer', padding: 0 }}>×</button>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void addChecklistItem(); }}
                placeholder="+ Tilføj opgave" style={{ fontSize: 11, flex: 1 }} />
              <button onClick={() => void addChecklistItem()} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Tilføj</button>
            </div>
          </div>
        )}

        {/* NOTER */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bd)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 8 }}>NOTER</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            onBlur={() => void patchCandidate({ notes: notes || null })}
            placeholder="Generelle noter om kandidaten…"
            style={{ width: '100%', minHeight: 70, fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
        </div>

        {/* KOMMENTARER */}
        <div style={{ padding: '14px 20px 10px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 12 }}>KOMMENTARER</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {comments.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, background: `${avatarColor(c.author_name)}22`, border: `1px solid ${avatarColor(c.author_name)}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: avatarColor(c.author_name) }}>
                  {initials(c.author_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{c.author_name}</span>
                    <span style={{ fontSize: 10, color: 'var(--t3)' }}>{timeAgo(c.created_at)}</span>
                  </div>
                  {editingCommentId === c.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <textarea value={editBody} onChange={e => setEditBody(e.target.value)} style={{ fontSize: 12, resize: 'vertical', minHeight: 60, width: '100%', boxSizing: 'border-box' }} autoFocus />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => void saveEditComment(c.id)} style={{ background: 'var(--bl)', color: '#fff', border: 'none', borderRadius: 5, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Gem</button>
                        <button onClick={() => setEditingComment(null)} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 5, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Annuller</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5 }}>{c.body}</div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                        <button onClick={() => { setEditingComment(c.id); setEditBody(c.body); }} style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 10, cursor: 'pointer', padding: 0 }}>Rediger</button>
                        <button onClick={() => void deleteComment(c.id)} style={{ background: 'none', border: 'none', color: 'var(--re)', fontSize: 10, cursor: 'pointer', padding: 0 }}>Slet</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {comments.length === 0 && <div style={{ fontSize: 12, color: 'var(--t3)', textAlign: 'center', padding: '8px 0' }}>Ingen kommentarer endnu</div>}
            <div ref={commentsEndRef} />
          </div>
        </div>

        {/* HISTORIK */}
        <div style={{ padding: '10px 20px 20px' }}>
          <div onClick={() => setHistoryOpen(o => !o)} style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: historyOpen ? 10 : 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {historyOpen ? '▾' : '▸'} HISTORIK
          </div>
          {historyOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {candidate.stage_history.map(h => {
                const from = h.from_stage ? stageConfig(h.from_stage)?.label ?? h.from_stage : null;
                const to = stageConfig(h.to_stage)?.label ?? h.to_stage;
                return (
                  <div key={h.id} style={{ fontSize: 11, color: 'var(--t2)' }}>
                    {h.changed_by_name ?? 'System'} · {from ? `${from} → ${to}` : `Oprettet: ${to}`} · {timeAgo(h.changed_at)}
                  </div>
                );
              })}
              {candidate.stage_history.length === 0 && <div style={{ fontSize: 11, color: 'var(--t3)' }}>Ingen historik</div>}
            </div>
          )}
        </div>
      </div>

      {/* Comment input */}
      <div style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--bd)', flexShrink: 0 }}>
        <textarea value={commentDraft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void sendComment(); }}
          placeholder="Skriv en kommentar…"
          style={{ width: '100%', fontSize: 12, resize: 'none', minHeight: 56, boxSizing: 'border-box', marginBottom: 8 }} />
        <button onClick={() => void sendComment()} disabled={sendingComment || !commentDraft.trim()}
          style={{ width: '100%', background: 'var(--bl)', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: commentDraft.trim() ? 1 : 0.5 }}>
          {sendingComment ? 'Sender…' : 'Send kommentar'}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bd)' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--t3)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--t2)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}
