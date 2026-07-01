'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DndContext, DragEndEvent, DragOverEvent, DragStartEvent,
  PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay,
  closestCorners,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/* ── Types ─────────────────────────────────────────────── */
export interface Board  { id: number; name: string; company_name: string; company_color: string; owner_user_id?: string | null }
export interface Column { id: number; name: string; position: number; color: string; board_id: number }
export interface CardLabel { text: string; color: string }
export interface Card {
  id: number; column_id: number; board_id: number; title: string;
  description: string | null; priority: string; due_date: string | null;
  assigned_to: string | null; assigned_name: string | null; completed_at: string | null;
  labels: string; cover_color: string | null;
  company_id: number | null; company_name: string | null; company_color: string | null;
}
interface CheckItem { id: number; card_id: number; text: string; completed: boolean; position: number }
interface Comment    { id: number; card_id: number; user_name: string; body: string; created_at: string }
interface BoardUser  { id: string; name: string; email: string; role: string }

const PRIORITY_COLOR: Record<string, string> = {
  low: '#4a5d78', normal: '#4f8ef7', high: '#f59e0b', urgent: '#f43f5e',
};
const LABEL_PALETTE = ['#ef4444','#f59e0b','#22c55e','#3b82f6','#a855f7','#ec4899','#14b8a6','#64748b'];

function parseLabels(raw: string | undefined | null): CardLabel[] {
  try { return JSON.parse(raw ?? '[]') as CardLabel[]; } catch { return []; }
}

/* ── Toast ─────────────────────────────────────────────── */
function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, [onDone]);
  return <div className="toast-container"><div className="toast">{msg}</div></div>;
}

/* ── Card item ──────────────────────────────────────────── */
function CardItem({ card, onClick, onToggleDone }: { card: Card; onClick: () => void; onToggleDone: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `card-${card.id}` });
  const labels = parseLabels(card.labels);
  const done = !!card.completed_at;
  return (
    <div ref={setNodeRef} style={{
      transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1,
      background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 9,
      cursor: 'grab', marginBottom: 6,
      borderLeft: `3px solid ${PRIORITY_COLOR[card.priority] ?? '#4a5d78'}`,
      overflow: 'hidden',
    }} {...attributes} {...listeners} onClick={onClick}>
      {card.cover_color && <div style={{ height: 6, background: card.cover_color }} />}
      <div style={{ padding: '10px 12px' }}>
        {labels.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            {labels.map((l, i) => (
              <span key={i} style={{ background: l.color, borderRadius: 3, padding: '1px 7px', fontSize: 10, color: '#fff', fontWeight: 600 }}>{l.text}</span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <button
            onClick={e => { e.stopPropagation(); onToggleDone(); }}
            title={done ? 'Markér som ikke færdig' : 'Markér som færdig'}
            style={{
              flexShrink: 0, marginTop: 1,
              width: 16, height: 16, borderRadius: '50%',
              border: `2px solid ${done ? 'var(--gr)' : 'var(--bd2)'}`,
              background: done ? 'var(--gr)' : 'transparent',
              cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 9, fontWeight: 700, lineHeight: 1,
              transition: 'all 0.15s',
            }}>
            {done ? '✓' : ''}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: done ? 'var(--t3)' : 'var(--t1)', marginBottom: card.description ? 4 : 0, textDecoration: done ? 'line-through' : 'none' }}>
              {card.title}
            </div>
            {card.description && (
              <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 6, lineHeight: 1.4 }}>
                {card.description.slice(0, 80)}{card.description.length > 80 ? '…' : ''}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {card.company_name && (
                <span style={{ fontSize: 10, color: 'var(--t2)', background: 'var(--s2)', padding: '2px 6px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                  {card.company_color && <span style={{ width: 6, height: 6, borderRadius: '50%', background: card.company_color, display: 'inline-block', flexShrink: 0 }} />}
                  {card.company_name}
                </span>
              )}
              {card.due_date && <span style={{ fontSize: 10, color: 'var(--t3)', background: 'var(--s2)', padding: '2px 6px', borderRadius: 4 }}>📅 {new Date(card.due_date + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}</span>}
              {card.assigned_name && <span style={{ fontSize: 10, color: 'var(--t3)', background: 'var(--s2)', padding: '2px 6px', borderRadius: 4 }}>👤 {card.assigned_name}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Card Modal ─────────────────────────────────────────── */
interface CardModalProps {
  card: Partial<Card>; columns: Column[]; boardId: number;
  companyName?: string; companyColor?: string;
  onSave: (d: Partial<Card>) => void; onDelete?: () => void; onClose: () => void;
}

function CardModal({ card, columns, boardId, companyName, companyColor, onSave, onDelete, onClose }: CardModalProps) {
  type ModalTab = 'main' | 'checklist' | 'comments';
  const [tab, setTab]           = useState<ModalTab>('main');
  const [editing, setEditing]   = useState(!card.id); // new cards start in edit mode
  const [title, setTitle]       = useState(card.title ?? '');
  const [desc, setDesc]         = useState(card.description ?? '');
  const [priority, setPriority] = useState(card.priority ?? 'normal');
  const [dueDate, setDueDate]   = useState(card.due_date ?? '');
  const [colId, setColId]       = useState(card.column_id ?? columns[0]?.id);
  const [done, setDone]         = useState(!!card.completed_at);
  const [assignedTo, setAssignedTo] = useState<string>(card.assigned_to ?? '');
  const [labels, setLabels]     = useState<CardLabel[]>(parseLabels(card.labels));
  const [coverColor, setCoverColor] = useState<string>(card.cover_color ?? '');
  const [newLabel, setNewLabel] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_PALETTE[0]);
  const [users, setUsers]       = useState<BoardUser[]>([]);

  const [companyId, setCompanyId]     = useState<number | ''>(card.company_id ?? '');
  const [companies, setCompanies]     = useState<{ id: number; name: string; color: string }[]>([]);

  const [checkItems, setCheckItems]   = useState<CheckItem[]>([]);
  const [newCheckText, setNewCheckText] = useState('');
  const [comments, setComments]       = useState<Comment[]>([]);
  const [newComment, setNewComment]   = useState('');
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    fetch(`/api/kanban/boards/${boardId}/users`).then(r => r.json()).then(setUsers);
    fetch('/api/companies').then(r => r.json()).then(setCompanies).catch(() => {});
    if (card.id) {
      fetch(`/api/kanban/cards/${card.id}/checklist`).then(r => r.json()).then(setCheckItems);
      fetch(`/api/kanban/cards/${card.id}/comments`).then(r => r.json()).then(setComments);
    }
  }, [boardId, card.id]);

  async function save() {
    if (!title.trim() || saving) return;
    setSaving(true);
    await onSave({
      title: title.trim(), description: desc.trim() || null, priority,
      due_date: dueDate || null, column_id: colId,
      completed_at: done ? (card.completed_at ?? new Date().toISOString()) : null,
      assigned_to: assignedTo || null,
      labels: JSON.stringify(labels),
      cover_color: coverColor || null,
      company_id: companyId || null,
    });
    setSaving(false);
  }

  async function addCheckItem() {
    if (!newCheckText.trim() || !card.id) return;
    const item = await fetch(`/api/kanban/cards/${card.id}/checklist`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: newCheckText.trim() }),
    }).then(r => r.json()) as CheckItem;
    setCheckItems(prev => [...prev, item]);
    setNewCheckText('');
  }

  async function toggleCheck(item: CheckItem) {
    const updated = await fetch(`/api/kanban/cards/${card.id}/checklist/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !item.completed }),
    }).then(r => r.json()) as CheckItem;
    setCheckItems(prev => prev.map(i => i.id === item.id ? updated : i));
  }

  async function deleteCheckItem(id: number) {
    await fetch(`/api/kanban/cards/${card.id}/checklist/${id}`, { method: 'DELETE' });
    setCheckItems(prev => prev.filter(i => i.id !== id));
  }

  async function addComment() {
    if (!newComment.trim() || !card.id) return;
    const c = await fetch(`/api/kanban/cards/${card.id}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: newComment.trim() }),
    }).then(r => r.json()) as Comment;
    setComments(prev => [...prev, c]);
    setNewComment('');
  }

  function addLabel() {
    if (!newLabel.trim()) return;
    setLabels(prev => [...prev, { text: newLabel.trim(), color: newLabelColor }]);
    setNewLabel('');
  }

  const checkDone  = checkItems.filter(i => i.completed).length;
  const checkTotal = checkItems.length;

  const TABS: { key: ModalTab; label: string }[] = [
    { key: 'main',      label: 'Detaljer' },
    { key: 'checklist', label: `Tjekliste${checkTotal ? ` (${checkDone}/${checkTotal})` : ''}` },
    { key: 'comments',  label: `Kommentarer${comments.length ? ` (${comments.length})` : ''}` },
  ];

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ background: 'var(--s1)', borderRadius: 13, width: 520, maxWidth: '96vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 40px 80px rgba(0,0,0,0.7)', overflow: 'hidden' }}>

        {/* Cover color strip */}
        {coverColor && <div style={{ height: 8, background: coverColor, flexShrink: 0 }} />}

        {/* Header */}
        <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: companyName ? 4 : 0 }}>
                {card.id ? (editing ? 'Rediger kort' : card.title) : 'Nyt kort'}
              </div>
              {companyName && !editing && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '2px 8px' }}>
                  {companyColor && <span style={{ width: 7, height: 7, borderRadius: '50%', background: companyColor, display: 'inline-block', flexShrink: 0 }} />}
                  <span style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600 }}>{companyName}</span>
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 18, cursor: 'pointer', padding: '0 4px', lineHeight: 1, flexShrink: 0 }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--bd)', marginBottom: 0 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: tab === t.key ? 700 : 500,
                color: tab === t.key ? 'var(--bl)' : 'var(--t3)',
                borderBottom: `2px solid ${tab === t.key ? 'var(--bl)' : 'transparent'}`,
                marginBottom: -1,
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {tab === 'main' && !editing && card.id && (
            /* ── View mode ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {labels.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {labels.map((l, i) => (
                    <span key={i} style={{ background: l.color, borderRadius: 4, padding: '3px 10px', fontSize: 11, color: '#fff', fontWeight: 600 }}>{l.text}</span>
                  ))}
                </div>
              )}
              {desc && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Beskrivelse</div>
                  <div style={{ fontSize: 13, color: 'var(--t1)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{desc}</div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Prioritet</div>
                  <span style={{ display: 'inline-block', background: `${PRIORITY_COLOR[priority]}22`, color: PRIORITY_COLOR[priority], borderRadius: 5, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                    {{ low: 'Lav', normal: 'Normal', high: 'Høj', urgent: 'Urgent' }[priority] ?? priority}
                  </span>
                </div>
                {dueDate && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Deadline</div>
                    <div style={{ fontSize: 13, color: 'var(--t1)' }}>📅 {new Date(dueDate + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  </div>
                )}
              </div>
              {assignedTo && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Tildelt til</div>
                  <div style={{ fontSize: 13, color: 'var(--t1)' }}>👤 {users.find(u => u.id === assignedTo)?.name ?? assignedTo}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Kolonne</div>
                <div style={{ fontSize: 13, color: 'var(--t1)' }}>{columns.find(c => c.id === colId)?.name ?? '—'}</div>
              </div>
              {companyId && (() => { const co = companies.find(c => c.id === companyId); return co ? (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Virksomhed</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '3px 10px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: co.color, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--t1)', fontWeight: 600 }}>{co.name}</span>
                  </div>
                </div>
              ) : null; })()}
              {done && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--gr)', fontSize: 14 }}>✓</span>
                  <span style={{ fontSize: 12, color: 'var(--gr)', fontWeight: 600 }}>Markeret som færdig</span>
                </div>
              )}
            </div>
          )}

          {tab === 'main' && editing && (
            /* ── Edit mode ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label>Titel</label><input value={title} onChange={e => setTitle(e.target.value)} autoFocus /></div>
              <div><label>Beskrivelse</label><textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} style={{ resize: 'vertical' }} /></div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label>Prioritet</label>
                  <select value={priority} onChange={e => setPriority(e.target.value)}>
                    <option value="low">Lav</option><option value="normal">Normal</option>
                    <option value="high">Høj</option><option value="urgent">Urgent</option>
                  </select>
                </div>
                <div><label>Deadline</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
              </div>

              <div><label>Tildel til</label>
                <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                  <option value="">— ingen —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>

              <div><label>Kolonne</label>
                <select value={colId} onChange={e => setColId(Number(e.target.value))}>
                  {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {companies.length > 0 && (
                <div><label>Virksomhed</label>
                  <select value={companyId} onChange={e => setCompanyId(e.target.value ? Number(e.target.value) : '')}>
                    <option value="">— ingen —</option>
                    {companies.map(co => <option key={co.id} value={co.id}>{co.name}</option>)}
                  </select>
                </div>
              )}

              {card.id && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={done} onChange={e => setDone(e.target.checked)} style={{ width: 'auto' }} />
                  <span style={{ fontSize: 12, color: 'var(--t2)' }}>Marker som færdig</span>
                </label>
              )}

              {/* Labels */}
              <div>
                <label>Labels</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                  {labels.map((l, i) => (
                    <span key={i} style={{ background: l.color, borderRadius: 4, padding: '3px 10px', fontSize: 11, color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => setLabels(prev => prev.filter((_, j) => j !== i))}>
                      {l.text} <span style={{ opacity: 0.7, fontSize: 10 }}>✕</span>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addLabel()}
                    placeholder="Label tekst" style={{ flex: 1 }} />
                  <div style={{ display: 'flex', gap: 3 }}>
                    {LABEL_PALETTE.map(c => (
                      <button key={c} onClick={() => setNewLabelColor(c)} style={{
                        width: 18, height: 18, borderRadius: 3, background: c, border: newLabelColor === c ? '2px solid var(--t1)' : '1px solid transparent', cursor: 'pointer', padding: 0,
                      }} />
                    ))}
                  </div>
                  <button onClick={addLabel} style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '6px 10px', fontSize: 11, color: 'var(--t2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Label</button>
                </div>
              </div>

              {/* Cover color */}
              <div>
                <label>Baggrundsfarve</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {['', '#ef4444','#f59e0b','#22c55e','#3b82f6','#a855f7','#ec4899','#14b8a6','#1e293b'].map(c => (
                    <button key={c} onClick={() => setCoverColor(c)} style={{
                      width: 24, height: 24, borderRadius: 4, background: c || 'var(--s2)', border: coverColor === c ? '2px solid var(--t1)' : '1px solid var(--bd)', cursor: 'pointer', padding: 0, fontSize: c ? 0 : 10, color: 'var(--t3)',
                    }}>{c ? '' : '✕'}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'checklist' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {checkTotal > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>
                    <span>Fremgang</span><span>{checkDone}/{checkTotal}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--s2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--gr)', width: `${checkTotal ? (checkDone / checkTotal) * 100 : 0}%`, transition: 'width 0.3s', borderRadius: 3 }} />
                  </div>
                </div>
              )}
              {checkItems.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--s2)', borderRadius: 7, padding: '8px 12px' }}>
                  <input type="checkbox" checked={item.completed} onChange={() => toggleCheck(item)} style={{ width: 'auto', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--t1)', textDecoration: item.completed ? 'line-through' : 'none', opacity: item.completed ? 0.6 : 1 }}>{item.text}</span>
                  <button onClick={() => deleteCheckItem(item.id)} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>✕</button>
                </div>
              ))}
              {card.id && (
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <input value={newCheckText} onChange={e => setNewCheckText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCheckItem()}
                    placeholder="Nyt punkt…" style={{ flex: 1 }} />
                  <button onClick={addCheckItem} style={{ background: 'var(--bl)', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Tilføj</button>
                </div>
              )}
              {!card.id && <div style={{ color: 'var(--t3)', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>Gem kortet først for at tilføje punkter</div>}
            </div>
          )}

          {tab === 'comments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {comments.length === 0 && <div style={{ color: 'var(--t3)', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>Ingen kommentarer endnu</div>}
              {comments.map(c => (
                <div key={c.id} style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>{c.user_name}</span>
                    <span style={{ fontSize: 10, color: 'var(--t3)' }}>{new Date(c.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.5 }}>{c.body}</div>
                </div>
              ))}
              {card.id && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 4 }}>
                  <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(); } }}
                    placeholder="Skriv en kommentar…" rows={2} style={{ flex: 1, resize: 'vertical' }} />
                  <button onClick={addComment} style={{ background: 'var(--bl)', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', height: 38 }}>Send</button>
                </div>
              )}
              {!card.id && <div style={{ color: 'var(--t3)', fontSize: 12, textAlign: 'center' }}>Gem kortet først for at kommentere</div>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0, background: 'var(--s1)' }}>
          {editing && card.id && onDelete && (
            <button onClick={onDelete} style={{ background: 'var(--re2)', color: 'var(--re)', border: '1px solid var(--re)', borderRadius: 7, padding: '8px 14px', fontSize: 12, marginRight: 'auto', cursor: 'pointer' }}>Slet</button>
          )}
          <button onClick={onClose} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}>Luk</button>
          {!editing && card.id ? (
            <button onClick={() => setEditing(true)} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>Rediger</button>
          ) : (
            <button onClick={save} disabled={saving} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
              {saving ? 'Gemmer…' : 'Gem'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Column Header ───────────────────────────────────────── */
interface ColHeaderProps {
  col: Column; cardCount: number;
  onAdd: () => void; onRename: (name: string) => void; onDelete: () => void; onCollapse: () => void; collapsed: boolean;
}

function ColumnHeader({ col, cardCount, onAdd, onRename, onDelete, onCollapse, collapsed }: ColHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName]       = useState(col.name);
  const [menu, setMenu]       = useState(false);
  const inputRef              = useRef<HTMLInputElement>(null);

  function submitRename() {
    if (name.trim() && name.trim() !== col.name) onRename(name.trim());
    setEditing(false);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, flexShrink: 0, display: 'inline-block' }} />
        {editing ? (
          <input ref={inputRef} value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') { setName(col.name); setEditing(false); } }}
            onBlur={submitRename} autoFocus
            style={{ fontSize: 12, fontWeight: 700, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--bl)', background: 'var(--s2)', color: 'var(--t1)', width: '100%' }} />
        ) : (
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', cursor: 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            onDoubleClick={() => { setEditing(true); setTimeout(() => inputRef.current?.select(), 0); }}>
            {col.name}
          </span>
        )}
        <span style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 400, flexShrink: 0 }}>{cardCount}</span>
      </div>
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        <button onClick={onAdd} style={{ background: 'none', color: 'var(--t3)', fontSize: 16, padding: '0 4px', border: 'none', cursor: 'pointer' }} title="Tilføj kort">+</button>
        <button onClick={() => setMenu(m => !m)} style={{ background: 'none', color: 'var(--t3)', fontSize: 13, padding: '0 4px', border: 'none', cursor: 'pointer' }}>⋯</button>
        {menu && (
          <div style={{ position: 'absolute', right: 0, top: 24, background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 10, minWidth: 150, overflow: 'hidden' }}>
            {[
              { label: editing ? 'Annuller omdøb' : 'Omdøb kolonne', action: () => { setEditing(e => !e); setMenu(false); } },
              { label: collapsed ? 'Udvid' : 'Skjul', action: () => { onCollapse(); setMenu(false); } },
              { label: 'Slet kolonne', action: () => { onDelete(); setMenu(false); }, danger: true },
            ].map(item => (
              <button key={item.label} onClick={item.action} style={{
                display: 'block', width: '100%', padding: '9px 14px', textAlign: 'left',
                fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none', background: 'none',
                color: (item as { danger?: boolean }).danger ? 'var(--re)' : 'var(--t2)',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Board Canvas ───────────────────────────────────────── */
interface BoardCanvasProps {
  boards: Board[];
  activeBoardId: number | null;
  onBoardChange?: (id: number) => void;
  columns: Column[];
  cards: Card[];
  onReload: () => void;
  onColumnReload: () => void;
  setColumns: React.Dispatch<React.SetStateAction<Column[]>>;
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  showBoardPicker?: boolean;
}

export function BoardCanvas({ boards, activeBoardId, onBoardChange, columns, cards, onReload, onColumnReload, setColumns, setCards, showBoardPicker }: BoardCanvasProps) {
  const [modal, setModal]       = useState<{ card: Partial<Card>; colId?: number } | null>(null);
  const [newColName, setNewColName] = useState('');
  const [addingCol, setAddingCol] = useState(false);
  const [toast, setToast]       = useState('');
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [showDone, setShowDone] = useState(true);
  const [search, setSearch]     = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  const allAssignees = Array.from(new Set(cards.filter(c => c.assigned_name).map(c => c.assigned_name!))).sort();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  function filterCards(colCards: Card[]) {
    return colCards.filter(c => {
      if (!showDone && c.completed_at) return false;
      if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterAssignee && c.assigned_name !== filterAssignee) return false;
      if (filterPriority && c.priority !== filterPriority) return false;
      return true;
    });
  }

  async function saveCard(data: Partial<Card>) {
    if (!activeBoardId) return;
    if (modal?.card.id) {
      await fetch(`/api/kanban/cards/${modal.card.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      setToast('Kort opdateret');
    } else {
      await fetch('/api/kanban/cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, board_id: activeBoardId, column_id: modal?.colId ?? columns[0]?.id }) });
      setToast('Kort oprettet');
    }
    setModal(null); onReload();
  }

  async function deleteCard() {
    if (!modal?.card.id || !activeBoardId) return;
    await fetch(`/api/kanban/cards/${modal.card.id}`, { method: 'DELETE' });
    setModal(null); setToast('Kort slettet'); onReload();
  }

  async function toggleDone(card: Card) {
    const completed_at = card.completed_at ? null : new Date().toISOString();
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, completed_at } : c));
    await fetch(`/api/kanban/cards/${card.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed_at }) });
    setToast(completed_at ? 'Kort markeret som færdigt' : 'Markering fjernet');
  }

  async function addColumn() {
    if (!newColName.trim() || !activeBoardId) return;
    await fetch(`/api/kanban/boards/${activeBoardId}/columns`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newColName.trim() }) });
    setNewColName(''); setAddingCol(false); onColumnReload();
  }

  async function renameColumn(col: Column, name: string) {
    await fetch(`/api/kanban/boards/${col.board_id}/columns`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: col.id, name }) });
    setColumns(prev => prev.map(c => c.id === col.id ? { ...c, name } : c));
  }

  async function deleteColumn(col: Column) {
    if (!confirm(`Slet kolonnen "${col.name}"? Alle kort flyttes til første kolonne.`)) return;
    const firstCol = columns.find(c => c.id !== col.id);
    if (firstCol) {
      for (const card of cards.filter(c => c.column_id === col.id)) {
        await fetch(`/api/kanban/cards/${card.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ column_id: firstCol.id }) });
      }
    }
    await fetch(`/api/kanban/boards/${col.board_id}/columns`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: col.id }) });
    onColumnReload(); onReload();
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    if (id.startsWith('card-')) setActiveCard(cards.find(c => c.id === parseInt(id.replace('card-', ''))) ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = event;
    if (!over || !activeBoardId) return;
    const activeId = String(active.id);
    const overId   = String(over.id);
    if (activeId.startsWith('card-') && overId.startsWith('col-')) {
      const cId = parseInt(activeId.replace('card-', ''));
      const colId = parseInt(overId.replace('col-', ''));
      await fetch(`/api/kanban/cards/${cId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ column_id: colId }) });
      onReload();
    }
  }

  async function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId   = String(over.id);
    if (activeId.startsWith('card-')) {
      const cardId = parseInt(activeId.replace('card-', ''));
      let targetColId: number | null = null;
      if (overId.startsWith('col-')) targetColId = parseInt(overId.replace('col-', ''));
      else if (overId.startsWith('card-')) { const oc = cards.find(c => c.id === parseInt(overId.replace('card-', ''))); if (oc) targetColId = oc.column_id; }
      if (targetColId !== null) setCards(prev => prev.map(c => c.id === cardId ? { ...c, column_id: targetColId! } : c));
    }
  }

  const board = boards.find(b => b.id === activeBoardId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      {/* Toolbar */}
      <div style={{ padding: '8px 18px', borderBottom: '1px solid var(--bd)', background: 'var(--s1)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
        {showBoardPicker && boards.length > 1 && (
          <select value={activeBoardId ?? ''} onChange={e => onBoardChange?.(Number(e.target.value))} style={{ width: 'auto', padding: '5px 8px', fontSize: 12 }}>
            {boards.map(b => <option key={b.id} value={b.id}>{b.name} — {b.company_name}</option>)}
          </select>
        )}
        {!showBoardPicker && board && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{board.name}</span>}

        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Søg kort…"
          style={{ width: 160, padding: '5px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--bd)', background: 'var(--s2)', color: 'var(--t1)' }} />

        {allAssignees.length > 0 && (
          <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} style={{ width: 'auto', padding: '5px 8px', fontSize: 12 }}>
            <option value="">Alle</option>
            {allAssignees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}

        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ width: 'auto', padding: '5px 8px', fontSize: 12 }}>
          <option value="">Alle prioriteter</option>
          <option value="urgent">Urgent</option>
          <option value="high">Høj</option>
          <option value="normal">Normal</option>
          <option value="low">Lav</option>
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--t2)', cursor: 'pointer', marginLeft: 'auto' }}>
          <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} style={{ width: 'auto' }} />
          Vis færdige
        </label>
      </div>

      {/* Board */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div style={{ display: 'flex', gap: 10, padding: 18, height: '100%', minWidth: 'max-content' }}>
            {columns.map(col => {
              const isCollapsed = collapsed.has(col.id);
              const allColCards = cards.filter(c => c.column_id === col.id);
              const visible     = filterCards(allColCards.filter(c => !c.completed_at));
              const donePile    = filterCards(allColCards.filter(c => c.completed_at));
              return (
                <div key={col.id} style={{ width: isCollapsed ? 42 : 220, minWidth: isCollapsed ? 42 : 220, flexShrink: 0, display: 'flex', flexDirection: 'column', transition: 'width 0.2s', minHeight: 0 }}>
                  {isCollapsed ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, paddingTop: 4 }}>
                      <button onClick={() => setCollapsed(prev => { const s = new Set(prev); s.delete(col.id); return s; })}
                        style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 6, padding: '6px 4px', cursor: 'pointer', color: 'var(--t3)', fontSize: 11 }}>▶</button>
                      <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 11, fontWeight: 700, color: 'var(--t2)', whiteSpace: 'nowrap' }}>{col.name} ({allColCards.length})</span>
                    </div>
                  ) : (
                    <>
                      <ColumnHeader col={col} cardCount={allColCards.length}
                        onAdd={() => setModal({ card: { priority: 'normal' }, colId: col.id })}
                        onRename={name => renameColumn(col, name)}
                        onDelete={() => deleteColumn(col)}
                        onCollapse={() => setCollapsed(prev => { const s = new Set(prev); s.add(col.id); return s; })}
                        collapsed={false} />
                      <SortableContext items={visible.map(c => `card-${c.id}`)} strategy={verticalListSortingStrategy}>
                        <div id={`col-${col.id}`} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                          {visible.map(card => <CardItem key={card.id} card={card} onClick={() => setModal({ card })} onToggleDone={() => toggleDone(card)} />)}
                          {showDone && donePile.length > 0 && (
                            <div style={{ borderTop: '1px dashed var(--bd)', paddingTop: 6, marginTop: 4 }}>
                              {donePile.map(card => <CardItem key={card.id} card={card} onClick={() => setModal({ card })} onToggleDone={() => toggleDone(card)} />)}
                            </div>
                          )}
                        </div>
                      </SortableContext>
                      <button onClick={() => setModal({ card: { priority: 'normal' }, colId: col.id })}
                        style={{ marginTop: 6, border: '1px dashed var(--bd)', borderRadius: 7, padding: '8px 0', color: 'var(--t3)', fontSize: 12, background: 'transparent', minHeight: 44, cursor: 'pointer' }}>
                        + Tilføj kort
                      </button>
                    </>
                  )}
                </div>
              );
            })}

            {/* Add column */}
            <div style={{ width: addingCol ? 220 : 150, minWidth: addingCol ? 220 : 150, flexShrink: 0 }}>
              {addingCol ? (
                <div style={{ border: '1px dashed var(--bd)', borderRadius: 9, padding: 12 }}>
                  <input value={newColName} onChange={e => setNewColName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addColumn(); if (e.key === 'Escape') setAddingCol(false); }}
                    placeholder="Kolonne navn" autoFocus style={{ marginBottom: 8 }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={addColumn} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 6, padding: '6px 12px', fontSize: 12, flex: 1, border: 'none', cursor: 'pointer' }}>Tilføj</button>
                    <button onClick={() => setAddingCol(false)} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>✕</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingCol(true)} style={{ width: '100%', border: '1px dashed var(--bd)', borderRadius: 9, padding: '10px 0', color: 'var(--t3)', fontSize: 12, background: 'transparent', minHeight: 44, cursor: 'pointer' }}>
                  + Ny kolonne
                </button>
              )}
            </div>
          </div>

          <DragOverlay>
            {activeCard && (
              <div style={{ background: 'var(--s1)', border: '1px solid var(--bl)', borderRadius: 9, padding: '10px 12px', width: 220, opacity: 0.95, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>{activeCard.title}</div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {modal && activeBoardId && (
        <CardModal card={modal.card} columns={columns} boardId={activeBoardId}
          companyName={board?.company_name} companyColor={board?.company_color}
          onSave={saveCard} onDelete={modal.card.id ? deleteCard : undefined} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
