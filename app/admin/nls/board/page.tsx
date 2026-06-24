'use client';

import { useEffect, useState } from 'react';
import {
  DndContext, DragEndEvent, DragOverEvent, DragStartEvent,
  PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay,
  closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Board  { id: number; name: string; company_name: string; company_color: string }
interface Column { id: number; name: string; position: number; color: string; board_id: number }
interface Card   {
  id: number; column_id: number; board_id: number; title: string;
  description: string | null; priority: string; due_date: string | null;
  assigned_name: string | null; completed_at: string | null;
}

const PRIORITY_COLOR: Record<string, string> = {
  low: '#4a5d78', normal: '#4f8ef7', high: '#f59e0b', urgent: '#f43f5e',
};

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="toast-container">
      <div className="toast">{msg}</div>
    </div>
  );
}

function CardItem({ card, onClick }: { card: Card; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `card-${card.id}` });
  return (
    <div ref={setNodeRef} style={{
      transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1,
      background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 9, padding: '10px 12px',
      cursor: 'grab', marginBottom: 6, borderLeft: `3px solid ${PRIORITY_COLOR[card.priority] ?? '#4a5d78'}`,
    }} {...attributes} {...listeners} onClick={onClick}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', marginBottom: card.description ? 4 : 0 }}>
        {card.completed_at && <span style={{ color: 'var(--gr)', marginRight: 6 }}>✓</span>}
        {card.title}
      </div>
      {card.description && (
        <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 6, lineHeight: 1.4 }}>
          {card.description.slice(0, 80)}{card.description.length > 80 ? '…' : ''}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {card.due_date && <span style={{ fontSize: 10, color: 'var(--t3)', background: 'var(--s2)', padding: '2px 6px', borderRadius: 4 }}>📅 {new Date(card.due_date + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}</span>}
        {card.assigned_name && <span style={{ fontSize: 10, color: 'var(--t3)', background: 'var(--s2)', padding: '2px 6px', borderRadius: 4 }}>👤 {card.assigned_name}</span>}
      </div>
    </div>
  );
}

interface CardModalProps { card: Partial<Card>; columns: Column[]; onSave: (d: Partial<Card>) => void; onDelete?: () => void; onClose: () => void }

function CardModal({ card, columns, onSave, onDelete, onClose }: CardModalProps) {
  const [title, setTitle]       = useState(card.title ?? '');
  const [desc, setDesc]         = useState(card.description ?? '');
  const [priority, setPriority] = useState(card.priority ?? 'normal');
  const [dueDate, setDueDate]   = useState(card.due_date ?? '');
  const [colId, setColId]       = useState(card.column_id ?? columns[0]?.id);
  const [done, setDone]         = useState(!!card.completed_at);

  function save() {
    if (!title.trim()) return;
    onSave({ title: title.trim(), description: desc.trim() || null, priority, due_date: dueDate || null, column_id: colId, completed_at: done ? (card.completed_at ?? new Date().toISOString()) : null });
  }

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ background: 'var(--s1)', borderRadius: 13, padding: 24, width: 440, maxWidth: '94vw', boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 18 }}>{card.id ? 'Rediger kort' : 'Nyt kort'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label>Titel</label><input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} autoFocus /></div>
          <div><label>Beskrivelse</label><textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} style={{ resize: 'vertical' }} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label>Prioritet</label><select value={priority} onChange={e => setPriority(e.target.value)}><option value="low">Lav</option><option value="normal">Normal</option><option value="high">Høj</option><option value="urgent">Urgent</option></select></div>
            <div><label>Deadline</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
          </div>
          <div><label>Kolonne</label><select value={colId} onChange={e => setColId(Number(e.target.value))}>{columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          {card.id && <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><input type="checkbox" checked={done} onChange={e => setDone(e.target.checked)} style={{ width: 'auto' }} /><span style={{ fontSize: 12, color: 'var(--t2)' }}>Marker som færdig</span></label>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          {card.id && onDelete && <button onClick={onDelete} style={{ background: 'var(--re2)', color: 'var(--re)', border: '1px solid var(--re)', borderRadius: 7, padding: '8px 14px', fontSize: 12, marginRight: 'auto' }}>Slet</button>}
          <button onClick={onClose} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12 }}>Annuller</button>
          <button onClick={save} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600 }}>Gem</button>
        </div>
      </div>
    </div>
  );
}

export default function NlsBoardPage() {
  const [boards, setBoards]             = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [columns, setColumns]           = useState<Column[]>([]);
  const [cards, setCards]               = useState<Card[]>([]);
  const [modal, setModal]               = useState<{ type: 'card'; card: Partial<Card>; colId?: number } | null>(null);
  const [newColName, setNewColName]     = useState('');
  const [addingCol, setAddingCol]       = useState(false);
  const [toast, setToast]               = useState('');
  const [activeCard, setActiveCard]     = useState<Card | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  async function loadBoards() {
    const data = await fetch('/api/kanban/boards').then(r => r.json()) as Board[];
    setBoards(data);
    if (data.length > 0 && !activeBoardId) setActiveBoardId(data[0].id);
  }

  async function loadBoard(boardId: number) {
    const [cols, cds] = await Promise.all([
      fetch(`/api/kanban/boards/${boardId}/columns`).then(r => r.json()) as Promise<Column[]>,
      fetch(`/api/kanban/cards?boardId=${boardId}`).then(r => r.json()) as Promise<Card[]>,
    ]);
    setColumns(cols);
    setCards(cds);
  }

  useEffect(() => { loadBoards(); }, []);
  useEffect(() => { if (activeBoardId) loadBoard(activeBoardId); }, [activeBoardId]);

  async function saveCard(data: Partial<Card>) {
    if (!activeBoardId) return;
    if (modal?.card.id) {
      await fetch(`/api/kanban/cards/${modal.card.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      setToast('Kort opdateret');
    } else {
      await fetch('/api/kanban/cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, board_id: activeBoardId, column_id: modal?.colId ?? columns[0]?.id }) });
      setToast('Kort oprettet');
    }
    setModal(null);
    loadBoard(activeBoardId);
  }

  async function deleteCard() {
    if (!modal?.card.id || !activeBoardId) return;
    await fetch(`/api/kanban/cards/${modal.card.id}`, { method: 'DELETE' });
    setModal(null);
    setToast('Kort slettet');
    loadBoard(activeBoardId);
  }

  async function addColumn() {
    if (!newColName.trim() || !activeBoardId) return;
    await fetch(`/api/kanban/boards/${activeBoardId}/columns`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newColName.trim() }) });
    setNewColName(''); setAddingCol(false);
    loadBoard(activeBoardId);
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    if (id.startsWith('card-')) setActiveCard(cards.find(c => c.id === parseInt(id.replace('card-', ''))) ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = event;
    if (!over || !activeBoardId) return;
    if (String(active.id).startsWith('card-') && String(over.id).startsWith('col-')) {
      await fetch(`/api/kanban/cards/${parseInt(String(active.id).replace('card-', ''))}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ column_id: parseInt(String(over.id).replace('col-', '')) }) });
      loadBoard(activeBoardId);
    }
  }

  async function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || !activeBoardId) return;
    if (String(active.id).startsWith('card-')) {
      const cardId = parseInt(String(active.id).replace('card-', ''));
      let targetColId: number | null = null;
      if (String(over.id).startsWith('col-')) targetColId = parseInt(String(over.id).replace('col-', ''));
      else if (String(over.id).startsWith('card-')) { const oc = cards.find(c => c.id === parseInt(String(over.id).replace('card-', ''))); if (oc) targetColId = oc.column_id; }
      if (targetColId !== null) setCards(prev => prev.map(c => c.id === cardId ? { ...c, column_id: targetColId! } : c));
    }
  }

  const board = boards.find(b => b.id === activeBoardId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--s1)', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--t1)' }}>{board?.name ?? 'Board'}</div>
          {board && <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>{board.company_name}</div>}
        </div>
        {boards.length > 1 && (
          <select value={activeBoardId ?? ''} onChange={e => setActiveBoardId(Number(e.target.value))} style={{ marginLeft: 'auto', width: 'auto', padding: '6px 10px', fontSize: 12 }}>
            {boards.map(b => <option key={b.id} value={b.id}>{b.name} — {b.company_name}</option>)}
          </select>
        )}
      </div>

      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div style={{ display: 'flex', gap: 10, padding: 18, height: '100%', minWidth: 'max-content' }}>
            {columns.map(col => {
              const colCards  = cards.filter(c => c.column_id === col.id && !c.completed_at);
              const doneCards = cards.filter(c => c.column_id === col.id && c.completed_at);
              return (
                <div key={col.id} style={{ width: 210, minWidth: 210, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, display: 'inline-block' }} />
                      {col.name}
                      <span style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 400 }}>{cards.filter(c => c.column_id === col.id).length}</span>
                    </div>
                    <button onClick={() => setModal({ type: 'card', card: { priority: 'normal' }, colId: col.id })} style={{ background: 'none', color: 'var(--t3)', fontSize: 16, padding: '0 4px', border: 'none', borderRadius: 4 }}>+</button>
                  </div>
                  <SortableContext items={colCards.map(c => `card-${c.id}`)} strategy={verticalListSortingStrategy}>
                    <div id={`col-${col.id}`} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                      {colCards.map(card => <CardItem key={card.id} card={card} onClick={() => setModal({ type: 'card', card })} />)}
                      {doneCards.length > 0 && (
                        <div style={{ borderTop: '1px dashed var(--bd)', paddingTop: 6, marginTop: 4 }}>
                          {doneCards.map(card => <CardItem key={card.id} card={card} onClick={() => setModal({ type: 'card', card })} />)}
                        </div>
                      )}
                    </div>
                  </SortableContext>
                  <button onClick={() => setModal({ type: 'card', card: { priority: 'normal' }, colId: col.id })}
                    style={{ marginTop: 6, border: '1px dashed var(--bd)', borderRadius: 7, padding: '8px 0', color: 'var(--t3)', fontSize: 12, background: 'transparent', minHeight: 44 }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = 'var(--bl)'; (e.target as HTMLElement).style.color = 'var(--bl)'; }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'var(--bd)'; (e.target as HTMLElement).style.color = 'var(--t3)'; }}>
                    + Tilføj kort
                  </button>
                </div>
              );
            })}

            <div style={{ width: addingCol ? 210 : 150, minWidth: addingCol ? 210 : 150, flexShrink: 0 }}>
              {addingCol ? (
                <div style={{ border: '1px dashed var(--bd)', borderRadius: 9, padding: 12 }}>
                  <input value={newColName} onChange={e => setNewColName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addColumn(); if (e.key === 'Escape') setAddingCol(false); }} placeholder="Kolonne navn" autoFocus style={{ marginBottom: 8 }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={addColumn} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 6, padding: '6px 12px', fontSize: 12, flex: 1 }}>Tilføj</button>
                    <button onClick={() => setAddingCol(false)} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '6px 10px', fontSize: 12 }}>✕</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingCol(true)} style={{ width: '100%', border: '1px dashed var(--bd)', borderRadius: 9, padding: '10px 0', color: 'var(--t3)', fontSize: 12, background: 'transparent', minHeight: 44 }}>
                  + Ny kolonne
                </button>
              )}
            </div>
          </div>

          <DragOverlay>
            {activeCard && (
              <div style={{ background: 'var(--s1)', border: '1px solid var(--bl)', borderRadius: 9, padding: '10px 12px', width: 210, opacity: 0.95, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>{activeCard.title}</div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {modal?.type === 'card' && (
        <CardModal card={modal.card} columns={columns} onSave={saveCard} onDelete={modal.card.id ? deleteCard : undefined} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
