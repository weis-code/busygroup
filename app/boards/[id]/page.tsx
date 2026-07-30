'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DndContext, DragEndEvent, DragOverEvent, DragStartEvent,
  PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay,
  closestCorners, useDroppable,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/* ── Types ─────────────────────────────────────────────── */
interface Label { text: string; color: string }
interface ChecklistItem { id: string; text: string; checked: boolean }
interface BoardCardT {
  id: number; list_id: number; board_id: number; title: string; description: string | null;
  position: number; assignees: string[]; labels: Label[]; due_date: string | null;
  start_date: string | null; cover_color: string | null; priority: string;
  checklist: ChecklistItem[]; is_archived: boolean; created_by: string | null;
  created_at: string; updated_at: string; comment_count?: number;
}
interface BoardList { id: number; board_id: number; title: string; position: number; color: string | null; is_archived: boolean }
interface Member { user_id: string; role: string; name: string; email: string; company_name: string | null; joined_at: string }
interface Board {
  id: number; title: string; description: string | null; owner_id: string; visibility: string;
  company_id: number | null; color: string; background: string | null; is_archived: boolean;
  role: string; lists: BoardList[]; cards: BoardCardT[]; members: Member[];
}
interface PlatformUser { id: string; name: string; email: string; role: string }
interface Comment { id: number; card_id: number; author_id: string; author_name: string; body: string; created_at: string; updated_at: string }
interface ActivityItem { id: number; card_id: number; user_id: string | null; user_name: string | null; type: string; data: Record<string, unknown>; created_at: string }

const LABEL_PALETTE = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#64748b'];
const COVER_PRESETS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#1e293b'];
const PRIORITY_META: Record<string, { label: string; color: string }> = {
  none: { label: 'Ingen', color: 'var(--t3)' },
  low: { label: 'Lav', color: 'var(--gr)' },
  medium: { label: 'Medium', color: 'var(--ye)' },
  high: { label: 'Høj', color: 'var(--or)' },
  urgent: { label: 'Urgent', color: 'var(--re)' },
};
const ROLE_LABEL: Record<string, string> = { admin: 'Admin', member: 'Medlem', viewer: 'Læser' };

function initials(name: string) { return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase(); }

function dueDateState(card: BoardCardT): 'future' | 'today' | 'overdue' | 'done' | null {
  if (!card.due_date) return null;
  if (card.checklist.length > 0 && card.checklist.every(i => i.checked)) return 'done';
  const due = new Date(card.due_date);
  const today = new Date();
  const dueDay = due.toISOString().slice(0, 10);
  const todayDay = today.toISOString().slice(0, 10);
  if (dueDay === todayDay) return 'today';
  if (due.getTime() < today.getTime()) return 'overdue';
  return 'future';
}
const DUE_STYLE: Record<string, { bg: string; color: string }> = {
  future: { bg: 'var(--s2)', color: 'var(--t3)' },
  today: { bg: 'var(--ye2)', color: 'var(--ye)' },
  overdue: { bg: 'var(--re2)', color: 'var(--re)' },
  done: { bg: 'var(--gr2)', color: 'var(--gr)' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'lige nu'; if (m < 60) return `${m} min. siden`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} timer siden`;
  const d = Math.floor(h / 24); return `${d} dage siden`;
}

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, [onDone]);
  return <div className="toast-container"><div className="toast">{msg}</div></div>;
}

/* ── Card item ─────────────────────────────────────────── */
function CardItem({ card, members, onClick }: { card: BoardCardT; members: Member[]; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `card-${card.id}` });
  const due = dueDateState(card);
  const checkDone = card.checklist.filter(i => i.checked).length;
  const checkTotal = card.checklist.length;
  const assignedMembers = card.assignees.map(id => members.find(m => m.user_id === id)).filter(Boolean) as Member[];
  const priorityMeta = PRIORITY_META[card.priority] ?? PRIORITY_META.none;

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} onClick={onClick} style={{
      transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1,
      background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 9,
      cursor: 'grab', marginBottom: 8, position: 'relative', overflow: 'hidden',
    }}
      onMouseEnter={e => { if (!isDragging) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--bd2)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)'; (e.currentTarget as HTMLElement).style.transform = `${CSS.Transform.toString(transform) ?? ''} translateY(-1px)`; } }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--bd)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.transform = CSS.Transform.toString(transform) ?? 'none'; }}
    >
      {card.cover_color && <div style={{ height: 32, background: card.cover_color }} />}
      {card.priority !== 'none' && (
        <span style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: '50%', background: priorityMeta.color }} />
      )}
      <div style={{ padding: '10px 12px' }}>
        {card.labels.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            {card.labels.map((l, i) => (
              <span key={i} style={{ background: l.color, height: 8, minWidth: 28, borderRadius: 100, display: 'inline-block' }} title={l.text} />
            ))}
          </div>
        )}
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 6, lineHeight: 1.4 }}>{card.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {card.description && <span style={{ fontSize: 11, color: 'var(--t3)' }}>📝</span>}
          {checkTotal > 0 && (
            <span style={{ fontSize: 10, color: checkDone === checkTotal ? 'var(--gr)' : 'var(--t3)', background: 'var(--s2)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
              ☑ {checkDone}/{checkTotal}
            </span>
          )}
          {due && (
            <span style={{ fontSize: 10, fontWeight: 600, background: DUE_STYLE[due].bg, color: DUE_STYLE[due].color, padding: '2px 6px', borderRadius: 4 }}>
              📅 {fmtDate(card.due_date!)} {due === 'done' && '✓'}
            </span>
          )}
          {!!card.comment_count && <span style={{ fontSize: 10, color: 'var(--t3)' }}>💬 {card.comment_count}</span>}
          {assignedMembers.length > 0 && (
            <div style={{ display: 'flex', marginLeft: 'auto' }}>
              {assignedMembers.slice(0, 3).map((m, i) => (
                <span key={m.user_id} title={m.name} style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--s3)', border: '1.5px solid var(--s1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--t2)', marginLeft: i > 0 ? -6 : 0 }}>
                  {initials(m.name)}
                </span>
              ))}
              {assignedMembers.length > 3 && (
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--s2)', border: '1.5px solid var(--s1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--t3)', marginLeft: -6 }}>
                  +{assignedMembers.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── List column ───────────────────────────────────────── */
function ListColumn({ list, cards, members, onAddCard, onOpenCard, onRename, onArchiveList, onDeleteList, canEdit }: {
  list: BoardList; cards: BoardCardT[]; members: Member[];
  onAddCard: (listId: number, title: string) => void;
  onOpenCard: (cardId: number) => void;
  onRename: (listId: number, title: string) => void;
  onArchiveList: (listId: number) => void;
  onDeleteList: (listId: number) => void;
  canEdit: boolean;
}) {
  const { attributes, listeners, setNodeRef: setSortRef, transform, transition } = useSortable({ id: `list-${list.id}` });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `listdrop-${list.id}` });
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [menu, setMenu] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function submitRename() {
    if (title.trim() && title.trim() !== list.title) onRename(list.id, title.trim());
    setEditing(false);
  }
  function submitAdd() {
    if (newTitle.trim()) onAddCard(list.id, newTitle.trim());
    setNewTitle('');
    inputRef.current?.focus();
  }

  return (
    <div ref={setSortRef} style={{ transform: CSS.Transform.toString(transform), transition, width: 270, minWidth: 270, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, position: 'relative' }}>
        {canEdit && <span {...attributes} {...listeners} style={{ cursor: 'grab', color: 'var(--t3)', fontSize: 12 }}>⋮⋮</span>}
        {editing ? (
          <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
            onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') { setTitle(list.title); setEditing(false); } }}
            onBlur={submitRename} style={{ fontSize: 13, fontWeight: 700, padding: '2px 6px', flex: 1 }} />
        ) : (
          <span onDoubleClick={() => canEdit && setEditing(true)} style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{list.title}</span>
        )}
        <span style={{ fontSize: 10, color: 'var(--t3)' }}>{cards.length}</span>
        {canEdit && (
          <>
            <button onClick={() => setMenu(m => !m)} style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 13, cursor: 'pointer', padding: '0 2px' }}>⋯</button>
            {menu && (
              <div style={{ position: 'absolute', right: 0, top: 22, background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 10, minWidth: 150, overflow: 'hidden' }}>
                <button onClick={() => { setEditing(true); setMenu(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 12, background: 'none', border: 'none', color: 'var(--t2)', cursor: 'pointer' }}>Omdøb</button>
                <button onClick={() => { onArchiveList(list.id); setMenu(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 12, background: 'none', border: 'none', color: 'var(--t2)', cursor: 'pointer' }}>Arkivér liste</button>
                <button onClick={() => { onDeleteList(list.id); setMenu(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 12, background: 'none', border: 'none', color: 'var(--re)', cursor: 'pointer' }}>Slet</button>
              </div>
            )}
          </>
        )}
      </div>

      <div ref={setDropRef} style={{ background: 'var(--s1)', border: `1px solid ${isOver ? 'var(--bl)' : 'var(--bd)'}`, borderRadius: 9, padding: 8, minHeight: 100, flex: 1, overflowY: 'auto', transition: 'border-color 0.1s' }}>
        <SortableContext items={cards.map(c => `card-${c.id}`)} strategy={verticalListSortingStrategy}>
          {cards.map(card => <CardItem key={card.id} card={card} members={members} onClick={() => onOpenCard(card.id)} />)}
        </SortableContext>
        {canEdit && (
          adding ? (
            <div>
              <input ref={inputRef} value={newTitle} onChange={e => setNewTitle(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === 'Enter') submitAdd(); if (e.key === 'Escape') setAdding(false); }}
                placeholder="Titel på kort…" style={{ fontSize: 13, marginBottom: 6 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={submitAdd} className="btn btn-sm btn-primary">Tilføj</button>
                <button onClick={() => setAdding(false)} className="btn btn-sm btn-ghost">✕</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} style={{ width: '100%', border: 'none', background: 'none', color: 'var(--t3)', fontSize: 12, padding: '8px 4px', textAlign: 'left', cursor: 'pointer' }}>
              + Tilføj kort
            </button>
          )
        )}
      </div>
    </div>
  );
}

/* ── Card detail modal ─────────────────────────────────── */
function CardModal({ card, board, members, onPatch, onArchive, onClose }: {
  card: BoardCardT; board: Board; members: Member[];
  onPatch: (patch: Partial<BoardCardT>) => void;
  onArchive: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [desc, setDesc] = useState(card.description ?? '');
  const [editingDesc, setEditingDesc] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [newComment, setNewComment] = useState('');
  const [newCheckText, setNewCheckText] = useState('');
  const [popup, setPopup] = useState<'members' | 'labels' | 'due' | 'cover' | 'priority' | null>(null);
  const [newLabelText, setNewLabelText] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_PALETTE[0]);

  const load = useCallback(async () => {
    const data = await fetch(`/api/boards/${board.id}/cards/${card.id}`).then(r => r.json());
    setComments(data.comments ?? []);
    setActivity(data.activity ?? []);
  }, [board.id, card.id]);

  useEffect(() => { void load(); }, [load]);

  function saveTitle() {
    if (title.trim() && title.trim() !== card.title) onPatch({ title: title.trim() });
    setEditingTitle(false);
  }
  function saveDesc() {
    onPatch({ description: desc.trim() || null });
    setEditingDesc(false);
  }

  async function addComment() {
    if (!newComment.trim()) return;
    await fetch(`/api/boards/${board.id}/cards/${card.id}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: newComment.trim() }),
    });
    setNewComment('');
    await load();
  }
  async function deleteComment(id: number) {
    await fetch(`/api/boards/${board.id}/cards/${card.id}/comments/${id}`, { method: 'DELETE' });
    await load();
  }

  function toggleAssignee(userId: string) {
    const has = card.assignees.includes(userId);
    onPatch({ assignees: has ? card.assignees.filter(id => id !== userId) : [...card.assignees, userId] });
  }

  const boardLabels = Array.from(
    new Map(board.cards.flatMap(c => c.labels).map(l => [`${l.text}__${l.color}`, l])).values()
  );
  function toggleLabel(label: Label) {
    const has = card.labels.some(l => l.text === label.text && l.color === label.color);
    onPatch({ labels: has ? card.labels.filter(l => !(l.text === label.text && l.color === label.color)) : [...card.labels, label] });
  }
  function createLabel() {
    if (!newLabelText.trim()) return;
    onPatch({ labels: [...card.labels, { text: newLabelText.trim(), color: newLabelColor }] });
    setNewLabelText('');
  }

  function addChecklistItem() {
    if (!newCheckText.trim()) return;
    onPatch({ checklist: [...card.checklist, { id: crypto.randomUUID(), text: newCheckText.trim(), checked: false }] });
    setNewCheckText('');
  }
  function toggleChecklistItem(id: string) {
    onPatch({ checklist: card.checklist.map(i => i.id === id ? { ...i, checked: !i.checked } : i) });
  }
  function removeChecklistItem(id: string) {
    onPatch({ checklist: card.checklist.filter(i => i.id !== id) });
  }

  const checkDone = card.checklist.filter(i => i.checked).length;
  const currentList = board.lists.find(l => l.id === card.list_id);
  const canEdit = board.role !== 'viewer';

  const ACTIVITY_TEXT: Record<string, (a: ActivityItem) => string> = {
    created: a => `${a.user_name ?? 'Nogen'} oprettede dette kort`,
    moved: a => `${a.user_name ?? 'Nogen'} flyttede dette kort fra ${board.lists.find(l => l.id === a.data.from_list)?.title ?? '?'} til ${board.lists.find(l => l.id === a.data.to_list)?.title ?? '?'}`,
    renamed: a => `${a.user_name ?? 'Nogen'} omdøbte kortet til "${a.data.to}"`,
    assigned: a => `${a.user_name ?? 'Nogen'} ændrede tildelte medlemmer`,
    due_date_set: a => `${a.user_name ?? 'Nogen'} satte forfaldsdato`,
    label_added: a => `${a.user_name ?? 'Nogen'} opdaterede labels`,
    comment_added: a => `${a.user_name ?? 'Nogen'} kommenterede`,
    archived: a => `${a.user_name ?? 'Nogen'} arkiverede kortet`,
  };

  const feed = [
    ...activity.filter(a => a.type !== 'comment_added').map(a => ({ type: 'activity' as const, at: a.created_at, item: a })),
    ...comments.map(c => ({ type: 'comment' as const, at: c.created_at, item: c })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--s1)', borderRadius: 13, width: 768, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 40px 80px rgba(0,0,0,0.7)', overflow: 'hidden' }}>
        {card.cover_color && (
          <div style={{ height: 90, background: card.cover_color, flexShrink: 0, position: 'relative' }}>
            <button onClick={() => onPatch({ cover_color: null })} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.4)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>Fjern forside</button>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px 0' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 240px', gap: 20, padding: '0 20px 20px' }}>
          {/* Left column */}
          <div style={{ minWidth: 0 }}>
            {card.labels.length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                {card.labels.map((l, i) => (
                  <span key={i} onClick={() => canEdit && setPopup('labels')} style={{ background: l.color, borderRadius: 4, padding: '3px 10px', fontSize: 11, color: '#fff', fontWeight: 600, cursor: canEdit ? 'pointer' : 'default' }}>{l.text}</span>
                ))}
              </div>
            )}

            {editingTitle ? (
              <textarea value={title} onChange={e => setTitle(e.target.value)} autoFocus rows={2}
                onBlur={saveTitle} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveTitle(); }}
                style={{ fontSize: 19, fontWeight: 700, width: '100%', resize: 'none' }} />
            ) : (
              <div onClick={() => canEdit && setEditingTitle(true)} style={{ fontSize: 19, fontWeight: 700, color: 'var(--t1)', marginBottom: 10, cursor: canEdit ? 'text' : 'default' }}>{card.title}</div>
            )}

            {canEdit && (
              <div style={{ marginBottom: 16 }}>
                <select value={card.list_id} onChange={e => onPatch({ list_id: Number(e.target.value) })} style={{ fontSize: 12, width: 'auto' }}>
                  {board.lists.map(l => <option key={l.id} value={l.id}>I liste: {l.title}</option>)}
                </select>
              </div>
            )}
            {!canEdit && currentList && <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 16 }}>I liste: {currentList.title}</div>}

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Beskrivelse</div>
              {editingDesc ? (
                <div>
                  <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={4} autoFocus style={{ width: '100%', resize: 'vertical', marginBottom: 6 }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={saveDesc} className="btn btn-sm btn-primary">Gem</button>
                    <button onClick={() => { setDesc(card.description ?? ''); setEditingDesc(false); }} className="btn btn-sm btn-ghost">Annuller</button>
                  </div>
                </div>
              ) : (
                <div onClick={() => canEdit && setEditingDesc(true)} style={{ fontSize: 13, color: card.description ? 'var(--t1)' : 'var(--t3)', lineHeight: 1.6, whiteSpace: 'pre-wrap', cursor: canEdit ? 'text' : 'default', minHeight: 20 }}>
                  {card.description || 'Tilføj en mere detaljeret beskrivelse…'}
                </div>
              )}
            </div>

            {card.checklist.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tjekliste</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>{checkDone}/{card.checklist.length}</div>
                </div>
                <div style={{ height: 6, background: 'var(--s2)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ height: '100%', width: `${(checkDone / card.checklist.length) * 100}%`, background: checkDone === card.checklist.length ? 'var(--gr)' : 'var(--bl)', transition: 'width 0.3s' }} />
                </div>
                {card.checklist.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                    <input type="checkbox" checked={item.checked} onChange={() => canEdit && toggleChecklistItem(item.id)} style={{ width: 'auto' }} disabled={!canEdit} />
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--t1)', textDecoration: item.checked ? 'line-through' : 'none', opacity: item.checked ? 0.6 : 1 }}>{item.text}</span>
                    {canEdit && <button onClick={() => removeChecklistItem(item.id)} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer' }}>✕</button>}
                  </div>
                ))}
                {canEdit && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <input value={newCheckText} onChange={e => setNewCheckText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addChecklistItem()} placeholder="Tilføj punkt…" style={{ flex: 1, fontSize: 12 }} />
                    <button onClick={addChecklistItem} className="btn btn-sm btn-primary">Tilføj</button>
                  </div>
                )}
              </div>
            )}

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Aktivitet</div>
              {feed.map((f, i) => f.type === 'activity' ? (
                <div key={`a${i}`} style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 8 }}>{ACTIVITY_TEXT[f.item.type]?.(f.item) ?? f.item.type} · {timeAgo(f.at)}</div>
              ) : (
                <div key={`c${i}`} style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>{(f.item as Comment).author_name}</span>
                    <span style={{ fontSize: 10, color: 'var(--t3)' }}>{fmtDateTime(f.at)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.5 }}>{(f.item as Comment).body}</div>
                  {(f.item as Comment).author_id === card.created_by || true ? (
                    <button onClick={() => deleteComment((f.item as Comment).id)} style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 10, cursor: 'pointer', marginTop: 4, padding: 0 }}>Slet</button>
                  ) : null}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <textarea value={newComment} onChange={e => setNewComment(e.target.value)} rows={2} placeholder="Skriv en kommentar…"
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addComment(); }}
                  style={{ flex: 1, resize: 'vertical', fontSize: 13 }} />
                <button onClick={addComment} className="btn btn-primary" style={{ alignSelf: 'flex-end' }}>Gem</button>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div style={{ position: 'relative' }}>
            {canEdit && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Tilføj til kort</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                  <button onClick={() => setPopup(popup === 'members' ? null : 'members')} className="btn btn-sm btn-ghost" style={{ justifyContent: 'flex-start' }}>👤 Medlemmer</button>
                  {popup === 'members' && (
                    <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 8, padding: 8, maxHeight: 200, overflowY: 'auto' }}>
                      {members.map(m => (
                        <label key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', fontSize: 12, cursor: 'pointer' }}>
                          <input type="checkbox" checked={card.assignees.includes(m.user_id)} onChange={() => toggleAssignee(m.user_id)} style={{ width: 'auto' }} />
                          {m.name}
                        </label>
                      ))}
                    </div>
                  )}

                  <button onClick={() => setPopup(popup === 'labels' ? null : 'labels')} className="btn btn-sm btn-ghost" style={{ justifyContent: 'flex-start' }}>🏷 Etiketter</button>
                  {popup === 'labels' && (
                    <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 8, padding: 8 }}>
                      {boardLabels.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                          {boardLabels.map((l, i) => (
                            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                              <input type="checkbox" checked={card.labels.some(cl => cl.text === l.text && cl.color === l.color)} onChange={() => toggleLabel(l)} style={{ width: 'auto' }} />
                              <span style={{ background: l.color, borderRadius: 4, padding: '2px 8px', fontSize: 11, color: '#fff' }}>{l.text}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 4 }}>
                        <input value={newLabelText} onChange={e => setNewLabelText(e.target.value)} placeholder="Ny label" style={{ flex: 1, fontSize: 11, padding: '4px 6px' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 3, marginTop: 6, flexWrap: 'wrap' }}>
                        {LABEL_PALETTE.map(c => (
                          <button key={c} onClick={() => setNewLabelColor(c)} style={{ width: 16, height: 16, borderRadius: 3, background: c, border: newLabelColor === c ? '2px solid var(--t1)' : 'none', cursor: 'pointer', padding: 0 }} />
                        ))}
                        <button onClick={createLabel} className="btn btn-sm btn-primary" style={{ marginLeft: 'auto' }}>Tilføj</button>
                      </div>
                    </div>
                  )}

                  {card.checklist.length === 0 && (
                    <button onClick={() => onPatch({ checklist: [{ id: crypto.randomUUID(), text: 'Nyt punkt', checked: false }] })} className="btn btn-sm btn-ghost" style={{ justifyContent: 'flex-start' }}>✓ Tjekliste</button>
                  )}

                  <button onClick={() => setPopup(popup === 'due' ? null : 'due')} className="btn btn-sm btn-ghost" style={{ justifyContent: 'flex-start' }}>📅 Forfaldsdato</button>
                  {popup === 'due' && (
                    <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input type="date" value={card.due_date?.slice(0, 10) ?? ''} onChange={e => onPatch({ due_date: e.target.value ? new Date(e.target.value).toISOString() : null })} style={{ fontSize: 12 }} />
                      {card.due_date && <button onClick={() => onPatch({ due_date: null })} className="btn btn-sm btn-ghost">Fjern dato</button>}
                    </div>
                  )}

                  <button onClick={() => setPopup(popup === 'cover' ? null : 'cover')} className="btn btn-sm btn-ghost" style={{ justifyContent: 'flex-start' }}>🎨 Forside</button>
                  {popup === 'cover' && (
                    <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 8, padding: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {COVER_PRESETS.map(c => (
                        <button key={c} onClick={() => onPatch({ cover_color: c })} style={{ width: 24, height: 24, borderRadius: 4, background: c, border: card.cover_color === c ? '2px solid var(--t1)' : 'none', cursor: 'pointer', padding: 0 }} />
                      ))}
                      <button onClick={() => onPatch({ cover_color: null })} style={{ width: 24, height: 24, borderRadius: 4, background: 'var(--s3)', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--t3)' }}>✕</button>
                    </div>
                  )}

                  <button onClick={() => setPopup(popup === 'priority' ? null : 'priority')} className="btn btn-sm btn-ghost" style={{ justifyContent: 'flex-start' }}>⬆ Prioritet</button>
                  {popup === 'priority' && (
                    <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {Object.entries(PRIORITY_META).map(([k, meta]) => (
                        <button key={k} onClick={() => onPatch({ priority: k })} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: '4px 2px', cursor: 'pointer', fontSize: 12, color: card.priority === k ? meta.color : 'var(--t2)', fontWeight: card.priority === k ? 700 : 400 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }} /> {meta.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Handlinger</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                  <button onClick={onArchive} className="btn btn-sm btn-ghost" style={{ justifyContent: 'flex-start' }}>🗄 Arkivér</button>
                </div>
              </>
            )}
            <div style={{ fontSize: 10, color: 'var(--t3)', lineHeight: 1.6 }}>
              Oprettet {fmtDate(card.created_at)}<br />
              Sidst opdateret {fmtDate(card.updated_at)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Members panel ─────────────────────────────────────── */
function MembersPanel({ board, members, allUsers, canManage, onClose, onReload }: {
  board: Board; members: Member[]; allUsers: PlatformUser[]; canManage: boolean; onClose: () => void; onReload: () => void;
}) {
  const [search, setSearch] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  const filtered = allUsers.filter(u =>
    !members.some(m => m.user_id === u.id) &&
    (u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
  ).slice(0, 8);

  async function invite(userId: string) {
    await fetch(`/api/boards/${board.id}/members`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, role: inviteRole }),
    });
    setSearch('');
    onReload();
  }
  async function changeRole(userId: string, role: string) {
    await fetch(`/api/boards/${board.id}/members/${userId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
    onReload();
  }
  async function remove(userId: string) {
    await fetch(`/api/boards/${board.id}/members/${userId}`, { method: 'DELETE' });
    onReload();
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ width: 420 }}>
        <div className="modal-title">Medlemmer</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, maxHeight: 240, overflowY: 'auto' }}>
          {members.map(m => (
            <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px' }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--s3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--t2)', flexShrink: 0 }}>{initials(m.name)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{m.name} {m.user_id === board.owner_id && '👑'}</div>
                <div style={{ fontSize: 10, color: 'var(--t3)' }}>{m.company_name ?? ''}</div>
              </div>
              {canManage && m.user_id !== board.owner_id ? (
                <select value={m.role} onChange={e => changeRole(m.user_id, e.target.value)} style={{ fontSize: 11, width: 'auto', padding: '3px 6px' }}>
                  <option value="admin">Admin</option><option value="member">Medlem</option><option value="viewer">Læser</option>
                </select>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--t3)' }}>{m.user_id === board.owner_id ? 'Ejer' : ROLE_LABEL[m.role]}</span>
              )}
              {canManage && m.user_id !== board.owner_id && (
                <button onClick={() => remove(m.user_id)} style={{ background: 'none', border: 'none', color: 'var(--re)', cursor: 'pointer', fontSize: 12 }}>Fjern</button>
              )}
            </div>
          ))}
        </div>
        {canManage && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Invitér medlem</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Søg navn eller email…" style={{ flex: 1, fontSize: 12 }} />
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ fontSize: 12, width: 'auto' }}>
                <option value="admin">Admin</option><option value="member">Medlem</option><option value="viewer">Læser</option>
              </select>
            </div>
            {search && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filtered.map(u => (
                  <button key={u.id} onClick={() => invite(u.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', padding: '6px 8px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: 'var(--t1)' }}>
                    {u.name} <span style={{ fontSize: 10, color: 'var(--bl)' }}>+ Invitér</span>
                  </button>
                ))}
                {filtered.length === 0 && <div style={{ fontSize: 12, color: 'var(--t3)' }}>Ingen brugere fundet</div>}
              </div>
            )}
          </>
        )}
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-ghost">Luk</button>
        </div>
      </div>
    </div>
  );
}

/* ── Main board page ────────────────────────────────────── */
export default function BoardPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [board, setBoard] = useState<Board | null>(null);
  const [allUsers, setAllUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [activeCardId, setActiveCardId] = useState<number | null>(null);
  const [addingList, setAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [dragActive, setDragActive] = useState<{ type: 'card' | 'list'; id: number } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/boards/${id}`);
    if (!res.ok) { setError(res.status === 403 ? 'Du har ikke adgang til dette board' : 'Kunne ikke indlæse board'); setLoading(false); return; }
    const data = await res.json();
    setBoard(data);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(d => setAllUsers(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);
  useEffect(() => {
    const cardParam = searchParams.get('card');
    if (cardParam) setActiveCardId(Number(cardParam));
  }, [searchParams]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  if (loading) return <div style={{ padding: 40, color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>;
  if (error || !board) return (
    <div style={{ padding: 40 }}>
      <div style={{ color: 'var(--re)', fontSize: 13, marginBottom: 12 }}>{error}</div>
      <button onClick={() => router.push('/boards')} className="btn btn-ghost">← Tilbage til boards</button>
    </div>
  );

  const canEdit = board.role !== 'viewer';
  const canManage = board.role === 'owner' || board.role === 'admin';

  function filterCards(cards: BoardCardT[]) {
    return cards.filter(c => {
      if (filterAssignee && !c.assignees.includes(filterAssignee)) return false;
      if (filterPriority && c.priority !== filterPriority) return false;
      return true;
    });
  }

  async function patchCard(cardId: number, patch: Partial<BoardCardT>) {
    setBoard(prev => prev ? { ...prev, cards: prev.cards.map(c => c.id === cardId ? { ...c, ...patch } : c) } : prev);
    await fetch(`/api/boards/${board!.id}/cards/${cardId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    await load();
  }

  async function archiveCard(cardId: number) {
    await fetch(`/api/boards/${board!.id}/cards/${cardId}`, { method: 'DELETE' });
    setActiveCardId(null);
    setToast('Kort arkiveret');
    await load();
  }

  async function addCard(listId: number, title: string) {
    const card = await fetch(`/api/boards/${board!.id}/cards`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ list_id: listId, title }),
    }).then(r => r.json());
    setBoard(prev => prev ? { ...prev, cards: [...prev.cards, card] } : prev);
  }

  async function addList() {
    if (!newListTitle.trim()) return;
    const list = await fetch(`/api/boards/${board!.id}/lists`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newListTitle.trim() }),
    }).then(r => r.json());
    setBoard(prev => prev ? { ...prev, lists: [...prev.lists, list] } : prev);
    setNewListTitle('');
    setAddingList(false);
  }

  async function renameList(listId: number, title: string) {
    setBoard(prev => prev ? { ...prev, lists: prev.lists.map(l => l.id === listId ? { ...l, title } : l) } : prev);
    await fetch(`/api/boards/${board!.id}/lists/${listId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
  }

  async function archiveList(listId: number) {
    if (!confirm('Arkivér listen og dens kort?')) return;
    await fetch(`/api/boards/${board!.id}/lists/${listId}`, { method: 'DELETE' });
    await load();
  }

  async function deleteList(listId: number) {
    if (!confirm('Slet listen permanent? Kortene arkiveres.')) return;
    await fetch(`/api/boards/${board!.id}/lists/${listId}`, { method: 'DELETE' });
    await load();
  }

  function handleDragStart(event: DragStartEvent) {
    const idStr = String(event.active.id);
    if (idStr.startsWith('card-')) setDragActive({ type: 'card', id: Number(idStr.replace('card-', '')) });
    else if (idStr.startsWith('list-')) setDragActive({ type: 'list', id: Number(idStr.replace('list-', '')) });
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || !board) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (!activeId.startsWith('card-')) return;

    const cardId = Number(activeId.replace('card-', ''));
    let targetListId: number | null = null;
    if (overId.startsWith('listdrop-')) targetListId = Number(overId.replace('listdrop-', ''));
    else if (overId.startsWith('card-')) {
      const overCard = board.cards.find(c => c.id === Number(overId.replace('card-', '')));
      if (overCard) targetListId = overCard.list_id;
    }
    if (targetListId !== null) {
      setBoard(prev => {
        if (!prev) return prev;
        const card = prev.cards.find(c => c.id === cardId);
        if (!card || card.list_id === targetListId) return prev;
        return { ...prev, cards: prev.cards.map(c => c.id === cardId ? { ...c, list_id: targetListId! } : c) };
      });
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDragActive(null);
    const { active, over } = event;
    if (!over || !board) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith('list-')) {
      const oldOrder = board.lists.map(l => l.id);
      const activeListId = Number(activeId.replace('list-', ''));
      const overListId = overId.startsWith('list-') ? Number(overId.replace('list-', '')) : activeListId;
      const oldIndex = oldOrder.indexOf(activeListId);
      const newIndex = oldOrder.indexOf(overListId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      const newOrder = arrayMove(oldOrder, oldIndex, newIndex);
      setBoard(prev => prev ? { ...prev, lists: newOrder.map(lid => prev.lists.find(l => l.id === lid)!) } : prev);
      await fetch(`/api/boards/${board.id}/lists/reorder`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: newOrder }) });
      return;
    }

    if (activeId.startsWith('card-')) {
      const cardId = Number(activeId.replace('card-', ''));
      const card = board.cards.find(c => c.id === cardId);
      if (!card) return;
      const listCards = board.cards.filter(c => c.list_id === card.list_id && c.id !== cardId);
      let insertIndex = listCards.length;
      if (overId.startsWith('card-')) {
        const overCardId = Number(overId.replace('card-', ''));
        const idx = listCards.findIndex(c => c.id === overCardId);
        if (idx !== -1) insertIndex = idx;
      }
      const reordered = [...listCards.slice(0, insertIndex), card, ...listCards.slice(insertIndex)];
      setBoard(prev => prev ? { ...prev, cards: prev.cards.map(c => {
        const idx = reordered.findIndex(r => r.id === c.id);
        return idx !== -1 ? { ...c, position: idx } : c;
      }) } : prev);
      await fetch(`/api/boards/${board.id}/cards/${cardId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ list_id: card.list_id, position: insertIndex }) });
    }
  }

  const activeCard = activeCardId ? board.cards.find(c => c.id === activeCardId) : null;
  const dragCard = dragActive?.type === 'card' ? board.cards.find(c => c.id === dragActive.id) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      {/* Top bar */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--bd)', background: 'var(--s1)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/boards')} style={{ background: 'none', border: 'none', color: 'var(--t2)', fontSize: 13, cursor: 'pointer' }}>← Boards</button>
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: board.color, flexShrink: 0 }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>{board.title}</div>
        <div style={{ display: 'flex', marginLeft: 8 }}>
          {board.members.slice(0, 5).map((m, i) => (
            <span key={m.user_id} title={m.name} style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--s3)', border: '1.5px solid var(--s1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--t2)', marginLeft: i > 0 ? -6 : 0 }}>{initials(m.name)}</span>
          ))}
        </div>
        <button onClick={() => setShowMembers(true)} className="btn btn-sm btn-ghost">+ Medlem</button>
        <button onClick={() => setShowFilters(v => !v)} className="btn btn-sm btn-ghost">Filter</button>
        <div style={{ flex: 1 }} />
      </div>

      {showFilters && (
        <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--bd)', display: 'flex', gap: 8 }}>
          <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} style={{ fontSize: 12, width: 'auto' }}>
            <option value="">Alle medlemmer</option>
            {board.members.map(m => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ fontSize: 12, width: 'auto' }}>
            <option value="">Alle prioriteter</option>
            {Object.entries(PRIORITY_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </div>
      )}

      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <SortableContext items={board.lists.map(l => `list-${l.id}`)} strategy={horizontalListSortingStrategy}>
            <div style={{ display: 'flex', gap: 10, padding: 18, minWidth: 'max-content', height: '100%' }}>
              {board.lists.map(list => (
                <ListColumn key={list.id} list={list}
                  cards={filterCards(board.cards.filter(c => c.list_id === list.id)).sort((a, b) => a.position - b.position)}
                  members={board.members}
                  onAddCard={addCard} onOpenCard={setActiveCardId}
                  onRename={renameList} onArchiveList={archiveList} onDeleteList={deleteList}
                  canEdit={canEdit}
                />
              ))}
              {canEdit && (
                <div style={{ width: 270, minWidth: 270, flexShrink: 0 }}>
                  {addingList ? (
                    <div style={{ border: '1px dashed var(--bd)', borderRadius: 9, padding: 10 }}>
                      <input value={newListTitle} onChange={e => setNewListTitle(e.target.value)} autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') addList(); if (e.key === 'Escape') setAddingList(false); }}
                        placeholder="Listenavn" style={{ marginBottom: 6, fontSize: 13 }} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={addList} className="btn btn-sm btn-primary">Tilføj</button>
                        <button onClick={() => setAddingList(false)} className="btn btn-sm btn-ghost">✕</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setAddingList(true)} style={{ width: '100%', border: '1px dashed var(--bd)', borderRadius: 9, padding: '10px 0', color: 'var(--t3)', fontSize: 12, background: 'transparent', cursor: 'pointer' }}>+ Tilføj liste</button>
                  )}
                </div>
              )}
            </div>
          </SortableContext>
          <DragOverlay>
            {dragCard && (
              <div style={{ background: 'var(--s1)', border: '1px solid var(--bl)', borderRadius: 9, padding: '10px 12px', width: 250, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{dragCard.title}</div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {activeCard && (
        <CardModal card={activeCard} board={board} members={board.members}
          onPatch={patch => patchCard(activeCard.id, patch)}
          onArchive={() => archiveCard(activeCard.id)}
          onClose={() => setActiveCardId(null)} />
      )}
      {showMembers && (
        <MembersPanel board={board} members={board.members} allUsers={allUsers} canManage={canManage}
          onClose={() => setShowMembers(false)} onReload={load} />
      )}
    </div>
  );
}
