'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay,
  PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable,
} from '@dnd-kit/core';

/* ── Types ─────────────────────────────────────────── */
interface Candidate {
  id: number; full_name: string; email: string | null; phone: string | null; linkedin: string | null;
  applying_for: string; company_id: number | null; company_name: string | null; company_color: string | null;
  stage: string; applied_at: string | null; interview_date: string | null;
  start_date: string | null; notes: string | null;
  comment_count: number; days_in_stage: number;
  created_at: string; updated_at: string;
}
interface Comment {
  id: number; candidate_id: number; author_id: string; author_name: string;
  body: string; created_at: string; updated_at: string;
}
interface Company { id: number; name: string; slug: string; color: string }

/* ── Stage config ───────────────────────────────────── */
const STAGES = [
  { key: 'applied',          label: 'ANSØGT',          emoji: '📬', color: 'var(--bl)'  },
  { key: 'no_response',      label: 'INTET SVAR',       emoji: '🔇', color: 'var(--t3)'  },
  { key: 'interview_booked', label: 'SAMTALE BOOKET',   emoji: '📅', color: 'var(--pu)'  },
  { key: 'follow_up',        label: 'OPFØLGNING',       emoji: '🔔', color: 'var(--ye)'  },
  { key: 'hired',            label: 'ANSAT',            emoji: '✅', color: 'var(--gr)'  },
  { key: 'stopped',          label: 'STOPPET',          emoji: '⛔', color: 'var(--re)'  },
];
const COLLAPSED_DEFAULT = new Set(['hired', 'stopped']);

/* ── Helpers ────────────────────────────────────────── */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Lige nu';
  if (m < 60) return `${m} min siden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} t siden`;
  return `${Math.floor(h / 24)} d siden`;
}

function fmtDateShort(d: string | null) {
  if (!d) return null;
  return new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

function fmtDatetime(dt: string | null) {
  if (!dt) return null;
  const d = new Date(dt);
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
       + ' kl. ' + d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ['#4f8ef7', '#2dd4a0', '#a78bfa', '#f59e0b', '#ff6b35'];
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

/* ── Droppable column wrapper ───────────────────────── */
function DroppableColumn({ stageKey, children }: { stageKey: string; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: stageKey });
  return (
    <div ref={setNodeRef} style={{
      flex: 1, minHeight: 100, borderRadius: 8,
      transition: 'background 0.1s',
      background: isOver ? 'rgba(79,142,247,0.06)' : 'transparent',
    }}>
      {children}
    </div>
  );
}

/* ── Draggable candidate card ───────────────────────── */
function DraggableCard({ candidate, stageColor, onClick }: {
  candidate: Candidate; stageColor: string; onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({ id: String(candidate.id) });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      style={{
        opacity: isDragging ? 0.35 : 1,
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 9,
        padding: '10px 12px', marginBottom: 6, cursor: 'grab',
        borderLeft: `3px solid ${stageColor}`,
      }}
      onClick={onClick}>
      <CandidateCardInner candidate={candidate} />
    </div>
  );
}

function CandidateCardInner({ candidate }: { candidate: Candidate }) {
  return (
    <>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 3 }}>{candidate.full_name}</div>
      <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 6 }}>{candidate.applying_for}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
        {candidate.company_name && (
          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: `${candidate.company_color ?? '#4f8ef7'}22`, color: candidate.company_color ?? '#4f8ef7' }}>
            {candidate.company_name}
          </span>
        )}
      </div>
      {candidate.stage === 'interview_booked' && candidate.interview_date && (
        <div style={{ fontSize: 10, color: 'var(--pu)', marginBottom: 4 }}>📅 {fmtDatetime(candidate.interview_date)}</div>
      )}
      {candidate.stage === 'hired' && candidate.start_date && (
        <div style={{ fontSize: 10, color: 'var(--gr)', marginBottom: 4 }}>🗓 Starter {fmtDateShort(candidate.start_date)}</div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {candidate.comment_count > 0 && (
          <span style={{ fontSize: 10, color: 'var(--t3)' }}>💬 {candidate.comment_count}</span>
        )}
        <span style={{ fontSize: 10, color: 'var(--t3)', marginLeft: 'auto' }}>{candidate.days_in_stage}d</span>
      </div>
    </>
  );
}

/* ── Toast ──────────────────────────────────────────── */
function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 500, color: 'var(--t1)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>{msg}</div>
    </div>
  );
}

/* ── Main page ─────────────────────────────────────── */
export default function HRRecruitmentPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [companies, setCompanies]   = useState<Company[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filterCompany, setFilter]  = useState('');
  const [collapsed, setCollapsed]   = useState<Set<string>>(new Set(COLLAPSED_DEFAULT));
  const [toast, setToast]           = useState('');
  const [activeId, setActiveId]     = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected]     = useState<(Candidate & { comments: Comment[] }) | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const load = useCallback(async () => {
    setLoading(true);
    const [cands, comp] = await Promise.all([
      fetch('/api/hr/candidates').then(r => r.json()),
      fetch('/api/companies').then(r => r.json()),
    ]);
    setCandidates(Array.isArray(cands) ? cands as Candidate[] : []);
    setCompanies(Array.isArray(comp) ? comp as Company[] : []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function openCandidate(id: number) {
    const data = await fetch(`/api/hr/candidates/${id}`).then(r => r.json()) as Candidate & { comments: Comment[] };
    setSelected(data);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const candidateId = Number(active.id);
    const newStage = String(over.id);
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate || candidate.stage === newStage) return;

    // Optimistic update
    setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, stage: newStage, updated_at: new Date().toISOString() } : c));

    fetch(`/api/hr/candidates/${candidateId}/stage`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage }),
    }).catch(() => void load());
  }

  const filtered = filterCompany ? candidates.filter(c => {
    const comp = companies.find(co => co.id === c.company_id);
    return comp?.slug === filterCompany;
  }) : candidates;

  const byStage = (key: string) => filtered.filter(c => c.stage === key);
  const activeDragging = activeId ? candidates.find(c => c.id === Number(activeId)) : null;
  const activeStageColor = activeDragging ? (STAGES.find(s => s.key === activeDragging.stage)?.color ?? 'var(--bl)') : 'var(--bl)';

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* Kanban board */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--bd)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>Rekruttering</h1>
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>{filtered.filter(c => !['hired','stopped'].includes(c.stage)).length} aktive kandidater</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            <select value={filterCompany} onChange={e => setFilter(e.target.value)} style={{ padding: '7px 12px', fontSize: 12, width: 'auto' }}>
              <option value="">Alle firmaer</option>
              {companies.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <button onClick={() => setShowCreate(true)} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
              + Ny kandidat
            </button>
          </div>
        </div>

        {/* Board */}
        {loading ? (
          <div style={{ color: 'var(--t3)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Indlæser…</div>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div style={{ display: 'flex', gap: 0, flex: 1, overflow: 'auto', padding: '16px 24px 24px' }}>
              {STAGES.map(stage => {
                const cards = byStage(stage.key);
                const isCollapsed = collapsed.has(stage.key);
                const canCollapse = stage.key === 'hired' || stage.key === 'stopped';
                return (
                  <div key={stage.key} style={{ width: 220, flexShrink: 0, marginRight: 10, display: 'flex', flexDirection: 'column' }}>
                    {/* Column header */}
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, cursor: canCollapse ? 'pointer' : 'default', userSelect: 'none' }}
                      onClick={canCollapse ? () => setCollapsed(prev => {
                        const next = new Set(prev);
                        if (next.has(stage.key)) next.delete(stage.key);
                        else next.add(stage.key);
                        return next;
                      }) : undefined}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--t2)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                        {stage.emoji} {stage.label}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--t3)', marginLeft: 2 }}>{cards.length}</span>
                      {canCollapse && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--t3)' }}>{isCollapsed ? '▸' : '▾'}</span>}
                    </div>

                    {/* Cards */}
                    {!isCollapsed && (
                      <DroppableColumn stageKey={stage.key}>
                        {cards.map(c => (
                          <DraggableCard key={c.id} candidate={c} stageColor={stage.color} onClick={() => void openCandidate(c.id)} />
                        ))}
                        {cards.length === 0 && (
                          <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 11, color: 'var(--t3)', opacity: 0.5 }}>Tom</div>
                        )}
                      </DroppableColumn>
                    )}
                    {isCollapsed && (
                      <DroppableColumn stageKey={stage.key}>
                        <div style={{ padding: '8px 12px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 8, textAlign: 'center', fontSize: 11, color: 'var(--t3)', cursor: 'pointer' }}
                          onClick={() => setCollapsed(prev => { const next = new Set(prev); next.delete(stage.key); return next; })}>
                          {cards.length} {cards.length === 1 ? 'kandidat' : 'kandidater'} — klik for at åbne
                        </div>
                      </DroppableColumn>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Drag overlay */}
            <DragOverlay>
              {activeDragging && (
                <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 9, padding: '10px 12px', width: 210, borderLeft: `3px solid ${activeStageColor}`, boxShadow: '0 12px 36px rgba(0,0,0,0.5)', cursor: 'grabbing' }}>
                  <CandidateCardInner candidate={activeDragging} />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Candidate detail panel */}
      {selected && (
        <CandidatePanel
          candidate={selected}
          companies={companies}
          onClose={() => setSelected(null)}
          onUpdated={async () => {
            await load();
            const fresh = await fetch(`/api/hr/candidates/${selected.id}`).then(r => r.json()) as Candidate & { comments: Comment[] };
            setSelected(fresh);
          }}
          onDeleted={() => { setSelected(null); void load(); }}
          onToast={setToast}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateCandidateModal
          companies={companies}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); void load(); }}
        />
      )}

      {toast && <Toast msg={toast} onDone={() => setToast('')} />}
    </div>
  );
}

/* ── Candidate detail panel ─────────────────────────── */
function CandidatePanel({ candidate, companies, onClose, onUpdated, onDeleted, onToast }: {
  candidate: Candidate & { comments: Comment[] };
  companies: Company[];
  onClose: () => void;
  onUpdated: () => Promise<void>;
  onDeleted: () => void;
  onToast: (m: string) => void;
}) {
  const [comments, setComments] = useState<Comment[]>(candidate.comments ?? []);
  const [commentDraft, setDraft] = useState('');
  const [sendingComment, setSending] = useState(false);
  const [editingCommentId, setEditingComment] = useState<number | null>(null);
  const [editBody, setEditBody] = useState('');
  const [stage, setStage] = useState(candidate.stage);
  const [notes, setNotes] = useState(candidate.notes ?? '');
  const [interviewDate, setInterviewDate] = useState(candidate.interview_date ? candidate.interview_date.slice(0, 16) : '');
  const [startDate, setStartDate] = useState(candidate.start_date ?? '');
  const [email, setEmail] = useState(candidate.email ?? '');
  const [phone, setPhone] = useState(candidate.phone ?? '');
  const [linkedin, setLinkedin] = useState(candidate.linkedin ?? '');
  const [companyId, setCompanyId] = useState<number | string>(candidate.company_id ?? '');
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setComments(candidate.comments ?? []);
    setStage(candidate.stage);
    setNotes(candidate.notes ?? '');
    setInterviewDate(candidate.interview_date ? candidate.interview_date.slice(0, 16) : '');
    setStartDate(candidate.start_date ?? '');
    setEmail(candidate.email ?? '');
    setPhone(candidate.phone ?? '');
    setLinkedin(candidate.linkedin ?? '');
    setCompanyId(candidate.company_id ?? '');
  }, [candidate]);

  async function patchCandidate(body: Record<string, unknown>) {
    await fetch(`/api/hr/candidates/${candidate.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await onUpdated();
  }

  async function sendComment() {
    if (!commentDraft.trim()) return;
    setSending(true);
    const res = await fetch(`/api/hr/candidates/${candidate.id}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: commentDraft.trim() }),
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
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: editBody.trim() }),
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

  const stageConfig = STAGES.find(s => s.key === stage);

  return (
    <div style={{ width: 380, flexShrink: 0, borderLeft: '1px solid var(--bd)', background: 'var(--s1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 18, cursor: 'pointer', padding: 0 }}>×</button>
          <button onClick={() => void deleteCandidate()} style={{ background: 'var(--re2)', color: 'var(--re)', border: '1px solid var(--re)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Slet</button>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>{candidate.full_name}</div>
        <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>{candidate.applying_for}</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {candidate.company_name && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: `${candidate.company_color ?? '#4f8ef7'}22`, color: candidate.company_color ?? '#4f8ef7' }}>
              {candidate.company_name}
            </span>
          )}
          <select value={stage} onChange={async e => {
            const newStage = e.target.value;
            setStage(newStage);
            await fetch(`/api/hr/candidates/${candidate.id}/stage`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ stage: newStage }),
            });
            await onUpdated();
          }} style={{ fontSize: 11, fontWeight: 700, color: stageConfig?.color ?? 'var(--t2)', background: `${stageConfig?.color ?? 'var(--t2)'}18`, border: `1px solid ${stageConfig?.color ?? 'var(--bd)'}`, borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>
            {STAGES.map(s => <option key={s.key} value={s.key}>{s.emoji} {s.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* DATOER */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bd)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 10 }}>DATOER</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--t3)' }}>Ansøgt</span>
              <span style={{ fontSize: 12, color: 'var(--t2)' }}>{candidate.applied_at ? new Date(candidate.applied_at + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--t3)' }}>Samtale</span>
              <input type="datetime-local" value={interviewDate}
                onChange={e => setInterviewDate(e.target.value)}
                onBlur={() => void patchCandidate({ interview_date: interviewDate || null })}
                style={{ fontSize: 11, width: 170 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--t3)' }}>Opstart</span>
              <input type="date" value={startDate}
                onChange={e => setStartDate(e.target.value)}
                onBlur={() => void patchCandidate({ start_date: startDate || null })}
                style={{ fontSize: 11, width: 140 }} />
            </div>
          </div>
        </div>

        {/* KONTAKTINFO */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bd)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 10 }}>KONTAKTINFO</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Email', val: email, set: setEmail, key: 'email' },
              { label: 'Telefon', val: phone, set: setPhone, key: 'phone' },
              { label: 'LinkedIn', val: linkedin, set: setLinkedin, key: 'linkedin' },
            ].map(({ label, val, set, key }) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--t3)', flexShrink: 0, width: 60 }}>{label}</span>
                <input value={val} onChange={e => set(e.target.value)}
                  onBlur={() => void patchCandidate({ [key]: val || null })}
                  placeholder="—" style={{ fontSize: 11, flex: 1 }} />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--t3)', flexShrink: 0, width: 60 }}>Firma</span>
              <select value={companyId} onChange={async e => {
                const v = e.target.value ? Number(e.target.value) : null;
                setCompanyId(v ?? '');
                await patchCandidate({ company_id: v });
              }} style={{ fontSize: 11, flex: 1 }}>
                <option value="">— Ingen —</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* NOTER */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bd)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 8 }}>NOTER</div>
          <textarea value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={() => void patchCandidate({ notes: notes || null })}
            placeholder="Generelle noter om kandidaten…"
            style={{ width: '100%', minHeight: 80, fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
        </div>

        {/* KOMMENTARER */}
        <div style={{ padding: '14px 20px 10px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 12 }}>KOMMENTARER</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {comments.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 8 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                  background: `${avatarColor(c.author_name)}22`, border: `1px solid ${avatarColor(c.author_name)}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 800, color: avatarColor(c.author_name),
                }}>
                  {initials(c.author_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{c.author_name}</span>
                    <span style={{ fontSize: 10, color: 'var(--t3)' }}>{timeAgo(c.created_at)}</span>
                  </div>
                  {editingCommentId === c.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <textarea value={editBody} onChange={e => setEditBody(e.target.value)}
                        style={{ fontSize: 12, resize: 'vertical', minHeight: 60, width: '100%', boxSizing: 'border-box' }} autoFocus />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => void saveEditComment(c.id)} style={{ background: 'var(--bl)', color: '#fff', border: 'none', borderRadius: 5, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Gem</button>
                        <button onClick={() => setEditingComment(null)} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 5, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Annuller</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5 }}>{c.body}</div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                        <button onClick={() => { setEditingComment(c.id); setEditBody(c.body); }}
                          style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 10, cursor: 'pointer', padding: 0 }}>Rediger</button>
                        <button onClick={() => void deleteComment(c.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--re)', fontSize: 10, cursor: 'pointer', padding: 0 }}>Slet</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {comments.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--t3)', textAlign: 'center', padding: '8px 0' }}>Ingen kommentarer endnu</div>
            )}
            <div ref={commentsEndRef} />
          </div>
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

/* ── Create candidate modal ─────────────────────────── */
function CreateCandidateModal({ companies, onClose, onCreated }: {
  companies: Company[]; onClose: () => void; onCreated: () => void;
}) {
  const [fullName, setFullName]     = useState('');
  const [email, setEmail]           = useState('');
  const [phone, setPhone]           = useState('');
  const [linkedin, setLinkedin]     = useState('');
  const [applyingFor, setApplyingFor] = useState('');
  const [companyId, setCompanyId]   = useState('');
  const [appliedAt, setAppliedAt]   = useState(new Date().toISOString().slice(0, 10));
  const [interviewDate, setInterviewDate] = useState('');
  const [startDate, setStartDate]   = useState('');
  const [notes, setNotes]           = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  async function submit() {
    if (!fullName.trim() || !applyingFor.trim()) { setError('Navn og stilling kræves'); return; }
    setSaving(true); setError('');
    const res = await fetch('/api/hr/candidates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName.trim(), email: email || null, phone: phone || null,
        linkedin: linkedin || null, applying_for: applyingFor.trim(),
        company_id: companyId ? Number(companyId) : null,
        applied_at: appliedAt || null,
        interview_date: interviewDate || null,
        start_date: startDate || null,
        notes: notes || null,
      }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json() as { error?: string }; setError(d.error ?? 'Fejl'); return; }
    onCreated();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--s1)', borderRadius: 13, padding: 24, width: 480, maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 20 }}>Ny kandidat</div>

        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>KANDIDAT</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div><label>Fulde navn *</label><input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Fornavn Efternavn" autoFocus /></div>
          <div><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="kandidat@example.com" /></div>
          <div><label>Telefon</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+45 12 34 56 78" /></div>
          <div><label>LinkedIn URL</label><input value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="linkedin.com/in/..." /></div>
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>STILLING</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div><label>Søger stilling som *</label><input value={applyingFor} onChange={e => setApplyingFor(e.target.value)} placeholder="fx Sælger, Account Manager, Developer" /></div>
          <div>
            <label>Tilknyttet firma</label>
            <select value={companyId} onChange={e => setCompanyId(e.target.value)}>
              <option value="">— Vælg firma —</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>DATOER</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div><label>Ansøgningsdato</label><input type="date" value={appliedAt} onChange={e => setAppliedAt(e.target.value)} /></div>
          <div><label>Samtaledato</label><input type="datetime-local" value={interviewDate} onChange={e => setInterviewDate(e.target.value)} /></div>
          <div><label>Opstartsdato</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>NOTER</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Fritekst noter om kandidaten"
          style={{ width: '100%', minHeight: 80, fontSize: 12, resize: 'vertical', boxSizing: 'border-box', marginBottom: 16 }} />

        {error && <div style={{ fontSize: 12, color: 'var(--re)', background: 'var(--re2)', padding: '8px 12px', borderRadius: 6, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12 }}>Annuller</button>
          <button onClick={() => void submit()} disabled={saving} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 18px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            {saving ? 'Opretter…' : 'Opret'}
          </button>
        </div>
      </div>
    </div>
  );
}
