'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, X, Check, Pencil, Trash2, MoreHorizontal,
  Calendar, User, Tag, Flag, MessageSquare, Lock, Users, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Column { id: string; name: string; position: number; color: string; }
interface Task {
  id: string; board_id: string; column_id: string;
  title: string; description: string | null;
  assigned_to: string | null; assigned_name: string | null;
  due_date: string | null; priority: string; labels: string;
  position: number; customer_id: string | null; customer_company: string | null;
  created_by: string | null; created_at: string; done: boolean;
}
interface Member { id: string; name: string; board_role: string; }
interface Board {
  id: string; name: string; description: string | null;
  visibility: string; color: string; owner_id: string;
  owner_name: string; customer_company: string | null;
}
interface Comment { id: string; content: string; user_name: string; created_at: string; }

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  low:    { label: 'Lav',    color: '#4A5568', bg: 'rgba(74,85,104,0.2)' },
  medium: { label: 'Medium', color: '#3498DB', bg: 'rgba(52,152,219,0.15)' },
  high:   { label: 'Høj',    color: '#E67E22', bg: 'rgba(230,126,34,0.15)' },
  urgent: { label: 'Kritisk',color: '#E84025', bg: 'rgba(232,64,37,0.15)' },
};

const LABEL_COLORS = ['#3498DB','#2ECC71','#9B59B6','#E67E22','#1ABC9C','#E74C3C','#F39C12','#E84025'];
function labelColor(label: string) { let h = 0; for (const c of label) h = (h * 31 + c.charCodeAt(0)) & 0xfffffff; return LABEL_COLORS[h % LABEL_COLORS.length]; }

function parseLabels(raw: string): string[] { try { return JSON.parse(raw) as string[]; } catch { return []; } }

function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xfffffff;
  const colors = ['#E84025','#3498DB','#2ECC71','#9B59B6','#E67E22','#1ABC9C'];
  const bg = colors[h % colors.length];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg + '33', border: `1.5px solid ${bg}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.floor(size * 0.42), fontWeight: 700, color: bg, flexShrink: 0 }}>
      {name[0].toUpperCase()}
    </div>
  );
}

function dueDateStyle(due: string): { color: string; bg: string } {
  const diff = new Date(due).getTime() - Date.now();
  if (diff < 0) return { color: '#E84025', bg: 'rgba(232,64,37,0.12)' };
  if (diff < 86400000 * 2) return { color: '#E67E22', bg: 'rgba(230,126,34,0.12)' };
  return { color: '#4A5568', bg: 'rgba(255,255,255,0.05)' };
}

export default function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [board,   setBoard]   = useState<Board | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [tasks,   setTasks]   = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [allUsers, setAllUsers] = useState<Member[]>([]);
  const [customers, setCustomers] = useState<{ id: string; company: string }[]>([]);

  // Task detail panel
  const [activeTask,   setActiveTask]   = useState<Task | null>(null);
  const [comments,     setComments]     = useState<Comment[]>([]);
  const [newComment,   setNewComment]   = useState('');
  const [editingTask,  setEditingTask]  = useState(false);
  const [taskForm,     setTaskForm]     = useState<Partial<Task>>({});
  const [newLabel,     setNewLabel]     = useState('');

  // Add task
  const [addingToCol,  setAddingToCol]  = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Add column
  const [addingCol,    setAddingCol]    = useState(false);
  const [newColName,   setNewColName]   = useState('');

  // Edit column name inline
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editColName,  setEditColName]  = useState('');

  // Drag state
  const dragTaskId  = useRef<string | null>(null);
  const dragOverCol = useRef<string | null>(null);

  // Board settings panel
  const [showSettings, setShowSettings] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) { toast.error('Ikke fundet'); router.push('/projects'); return; }
    const data = await res.json() as { board: Board; columns: Column[]; tasks: Task[]; members: Member[] };
    setBoard(data.board);
    setColumns(data.columns);
    setTasks(data.tasks);
    setMembers(data.members);
  }, [id, router]);

  useEffect(() => {
    load();
    fetch('/api/users').then(r => r.json()).then(d => setAllUsers(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/customers').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : [])).catch(() => {});
  }, [load]);

  // ─── Task actions ─────────────────────────────────────────────────────────
  const openTask = async (task: Task) => {
    setActiveTask(task);
    setTaskForm({ title: task.title, description: task.description, assigned_to: task.assigned_to, due_date: task.due_date, priority: task.priority, labels: task.labels, customer_id: task.customer_id });
    setEditingTask(false);
    const res = await fetch(`/api/projects/tasks/${task.id}/comments`);
    if (res.ok) setComments(await res.json() as Comment[]);
  };

  const saveTask = async () => {
    if (!activeTask) return;
    const res = await fetch(`/api/projects/tasks/${activeTask.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskForm),
    });
    if (res.ok) {
      const updated = await res.json() as Task;
      setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
      setActiveTask(updated);
      setEditingTask(false);
      toast.success('Opgave gemt');
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('Slet opgaven?')) return;
    await fetch(`/api/projects/tasks/${taskId}`, { method: 'DELETE' });
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setActiveTask(null);
    toast.success('Opgave slettet');
  };

  const toggleDone = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    const next = !task.done;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: next } : t));
    if (activeTask?.id === task.id) setActiveTask(prev => prev ? { ...prev, done: next } : null);
    await fetch(`/api/projects/tasks/${task.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: next }),
    });
  };

  const addTask = async (colId: string) => {
    if (!newTaskTitle.trim()) return;
    const res = await fetch(`/api/projects/${id}/tasks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ column_id: colId, title: newTaskTitle.trim() }),
    });
    if (res.ok) {
      const task = await res.json() as Task;
      setTasks(prev => [...prev, task]);
      setNewTaskTitle('');
      setAddingToCol(null);
    }
  };

  const postComment = async () => {
    if (!newComment.trim() || !activeTask) return;
    const res = await fetch(`/api/projects/tasks/${activeTask.id}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: newComment }),
    });
    if (res.ok) {
      const c = await res.json() as Comment;
      setComments(prev => [...prev, c]);
      setNewComment('');
    }
  };

  // ─── Column actions ──────────────────────────────────────────────────────
  const addColumn = async () => {
    if (!newColName.trim()) return;
    const res = await fetch(`/api/projects/${id}/columns`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newColName.trim() }),
    });
    if (res.ok) {
      const col = await res.json() as Column;
      setColumns(prev => [...prev, col]);
      setNewColName('');
      setAddingCol(false);
    }
  };

  const renameColumn = async (colId: string) => {
    if (!editColName.trim()) return;
    await fetch(`/api/projects/${id}/columns/${colId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editColName.trim() }),
    });
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, name: editColName.trim() } : c));
    setEditingColId(null);
  };

  const deleteColumn = async (colId: string) => {
    const colTasks = tasks.filter(t => t.column_id === colId);
    if (!confirm(`Slet kolonnen? ${colTasks.length > 0 ? `${colTasks.length} opgaver slettes.` : ''}`)) return;
    await fetch(`/api/projects/${id}/columns/${colId}`, { method: 'DELETE' });
    setColumns(prev => prev.filter(c => c.id !== colId));
    setTasks(prev => prev.filter(t => t.column_id !== colId));
  };

  // ─── Drag & drop ─────────────────────────────────────────────────────────
  const onDragStart = (taskId: string) => { dragTaskId.current = taskId; };
  const onDragOver  = (e: React.DragEvent, colId: string) => { e.preventDefault(); dragOverCol.current = colId; };

  const onDrop = async (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    const tid = dragTaskId.current;
    if (!tid) return;
    dragTaskId.current = null;
    dragOverCol.current = null;

    const task = tasks.find(t => t.id === tid);
    if (!task || task.column_id === colId) return;

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === tid ? { ...t, column_id: colId } : t));
    if (activeTask?.id === tid) setActiveTask(prev => prev ? { ...prev, column_id: colId } : null);

    await fetch(`/api/projects/tasks/${tid}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ column_id: colId }),
    });
  };

  if (!board) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#4A5568' }}>
        Indlæser...
      </div>
    );
  }

  const inp: React.CSSProperties = {
    background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7,
    padding: '7px 10px', color: '#ECF0F1', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0C0F14', overflow: 'hidden' }}>

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div style={{ height: 54, flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', background: '#0A0D12' }}>
        <button onClick={() => router.push('/projects')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A5568', display: 'flex', alignItems: 'center', gap: 5, padding: '4px 6px', borderRadius: 6 }}>
          <ArrowLeft size={14} /> <span style={{ fontSize: 12 }}>Projekter</span>
        </button>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)' }} />

        <div style={{ width: 10, height: 10, borderRadius: '50%', background: board.color, flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 15, color: '#ECF0F1' }}>{board.name}</span>

        {board.visibility === 'private'
          ? <Lock size={12} style={{ color: '#4A5568' }} />
          : <Users size={12} style={{ color: '#4A5568' }} />
        }

        {board.customer_company && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: 'rgba(232,64,37,0.12)', color: '#E84025', textTransform: 'uppercase' }}>
            {board.customer_company}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Member avatars */}
        <div style={{ display: 'flex', gap: -4 }}>
          {members.slice(0, 5).map(m => (
            <div key={m.id} title={m.name} style={{ marginLeft: -6 }}><Avatar name={m.name} size={26} /></div>
          ))}
          {members.length > 5 && <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#667788', marginLeft: -6 }}>+{members.length - 5}</div>}
        </div>

        <button
          onClick={() => setShowSettings(s => !s)}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '5px 10px', color: '#667788', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {/* ── Kanban board ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflowX: 'auto', overflowY: 'hidden', padding: '20px 16px', gap: 12, alignItems: 'flex-start' }}>

        {columns.map(col => {
          const colTasks = tasks.filter(t => t.column_id === col.id);
          return (
            <div
              key={col.id}
              onDragOver={e => onDragOver(e, col.id)}
              onDrop={e => onDrop(e, col.id)}
              style={{ width: 272, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, background: '#111820', borderRadius: 12, padding: '0 0 8px', border: '1px solid rgba(255,255,255,0.06)', maxHeight: 'calc(100vh - 130px)', overflow: 'hidden' }}
            >
              {/* Column header */}
              <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, flexShrink: 0 }} />

                {editingColId === col.id ? (
                  <input
                    autoFocus
                    value={editColName}
                    onChange={e => setEditColName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') renameColumn(col.id); if (e.key === 'Escape') setEditingColId(null); }}
                    onBlur={() => renameColumn(col.id)}
                    style={{ ...inp, flex: 1, padding: '3px 7px', fontSize: 12 }}
                  />
                ) : (
                  <span
                    onDoubleClick={() => { setEditingColId(col.id); setEditColName(col.name); }}
                    style={{ flex: 1, fontWeight: 600, fontSize: 12, color: '#B0C0D0', cursor: 'default', userSelect: 'none' }}
                    title="Dobbeltklik for at omdøbe"
                  >
                    {col.name}
                  </span>
                )}

                <span style={{ fontSize: 10, color: '#2D3748', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '1px 7px', fontWeight: 600 }}>{colTasks.length}</span>

                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => { setEditingColId(col.id); setEditColName(col.name); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2D3748', padding: 2, display: 'flex', borderRadius: 4 }}
                    title="Omdøb"
                  ><Pencil size={11} /></button>
                </div>

                <button
                  onClick={() => deleteColumn(col.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2D3748', padding: 2, display: 'flex', borderRadius: 4 }}
                  title="Slet kolonne"
                ><X size={11} /></button>
              </div>

              {/* Tasks */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {colTasks.map(task => {
                  const pCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
                  const labels = parseLabels(task.labels);
                  const isDue = task.due_date;
                  const dueStyle = isDue ? dueDateStyle(task.due_date!) : null;
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => onDragStart(task.id)}
                      onClick={() => openTask(task)}
                      style={{ background: '#0C0F14', borderRadius: 9, padding: '10px 11px', cursor: 'pointer', border: `1px solid ${task.done ? 'rgba(46,204,113,0.15)' : 'rgba(255,255,255,0.05)'}`, transition: 'border-color 0.12s', userSelect: 'none', opacity: task.done ? 0.65 : 1 }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = task.done ? 'rgba(46,204,113,0.3)' : 'rgba(255,255,255,0.12)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = task.done ? 'rgba(46,204,113,0.15)' : 'rgba(255,255,255,0.05)')}
                    >
                      {/* Labels */}
                      {labels.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 7 }}>
                          {labels.map(l => (
                            <span key={l} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: labelColor(l) + '22', color: labelColor(l), textTransform: 'uppercase' }}>{l}</span>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 8 }}>
                        {/* Done checkbox */}
                        <button
                          onClick={e => toggleDone(e, task)}
                          title={task.done ? 'Marker som ikke færdig' : 'Marker som færdig'}
                          style={{
                            flexShrink: 0, marginTop: 1,
                            width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${task.done ? '#2ECC71' : 'rgba(255,255,255,0.2)'}`,
                            background: task.done ? '#2ECC71' : 'transparent',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s',
                          }}
                        >
                          {task.done && <Check size={9} color="#fff" strokeWidth={3} />}
                        </button>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#D0DDE8', lineHeight: 1.4, textDecoration: task.done ? 'line-through' : 'none', opacity: task.done ? 0.6 : 1 }}>{task.title}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {/* Priority */}
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: pCfg.bg, color: pCfg.color, textTransform: 'uppercase' }}>
                          {pCfg.label}
                        </span>

                        {/* Due date */}
                        {isDue && dueStyle && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: dueStyle.color, background: dueStyle.bg, padding: '2px 6px', borderRadius: 4 }}>
                            <Calendar size={9} />
                            {new Date(task.due_date!).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
                          </span>
                        )}

                        {/* Customer */}
                        {task.customer_company && (
                          <span style={{ fontSize: 9, color: '#E84025', background: 'rgba(232,64,37,0.1)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{task.customer_company}</span>
                        )}

                        <div style={{ flex: 1 }} />

                        {/* Assigned avatar */}
                        {task.assigned_name && <Avatar name={task.assigned_name} size={20} />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add task */}
              {addingToCol === col.id ? (
                <div style={{ padding: '0 8px 4px', flexShrink: 0 }}>
                  <textarea
                    autoFocus
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addTask(col.id); } if (e.key === 'Escape') { setAddingToCol(null); setNewTaskTitle(''); } }}
                    placeholder="Opgavetitel... (Enter for at tilføje)"
                    rows={2}
                    style={{ ...inp, width: '100%', resize: 'none', fontSize: 12, marginBottom: 6 }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => addTask(col.id)} style={{ flex: 1, background: '#E84025', border: 'none', borderRadius: 6, padding: '6px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Check size={11} /> Tilføj</button>
                    <button onClick={() => { setAddingToCol(null); setNewTaskTitle(''); }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '6px 10px', color: '#4A5568', fontSize: 12, cursor: 'pointer' }}><X size={11} /></button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '2px 8px 0', flexShrink: 0 }}>
                  <button
                    onClick={() => { setAddingToCol(col.id); setNewTaskTitle(''); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 7, border: 'none', background: 'transparent', color: '#2D3748', fontSize: 12, cursor: 'pointer', transition: 'color 0.12s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#667788')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#2D3748')}
                  >
                    <Plus size={13} /> Tilføj opgave
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Add column */}
        {addingCol ? (
          <div style={{ width: 240, flexShrink: 0, background: '#111820', borderRadius: 12, padding: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
            <input
              autoFocus
              value={newColName}
              onChange={e => setNewColName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addColumn(); if (e.key === 'Escape') setAddingCol(false); }}
              placeholder="Kolonnenavn..."
              style={{ ...inp, width: '100%', marginBottom: 8, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={addColumn} style={{ flex: 1, background: '#E84025', border: 'none', borderRadius: 6, padding: '7px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Tilføj</button>
              <button onClick={() => setAddingCol(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '7px 10px', color: '#4A5568', fontSize: 12, cursor: 'pointer' }}><X size={11} /></button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingCol(true)}
            style={{ width: 200, flexShrink: 0, height: 44, background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 12, color: '#3A4A5A', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'border-color 0.15s, color 0.15s' }}
            onMouseEnter={e => { (e.currentTarget).style.borderColor = 'rgba(255,255,255,0.2)'; (e.currentTarget).style.color = '#667788'; }}
            onMouseLeave={e => { (e.currentTarget).style.borderColor = 'rgba(255,255,255,0.1)'; (e.currentTarget).style.color = '#3A4A5A'; }}
          >
            <Plus size={14} /> Tilføj kolonne
          </button>
        )}
      </div>

      {/* ── Task detail panel (slide-in from right) ───────────────────────── */}
      {activeTask && (
        <>
          <div onClick={() => setActiveTask(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 460, background: '#0F1420', borderLeft: '1px solid rgba(255,255,255,0.08)', zIndex: 201, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Detail header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{ flex: 1 }}>
                {editingTask ? (
                  <input
                    value={taskForm.title || ''}
                    onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))}
                    style={{ ...inp, width: '100%', fontSize: 14, fontWeight: 600 }}
                    autoFocus
                  />
                ) : (
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#ECF0F1', lineHeight: 1.3 }}>{activeTask.title}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {editingTask ? (
                  <>
                    <button onClick={saveTask} style={{ background: '#E84025', border: 'none', borderRadius: 6, padding: '6px 12px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Check size={12} /> Gem</button>
                    <button onClick={() => setEditingTask(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px', color: '#4A5568', fontSize: 12, cursor: 'pointer' }}><X size={12} /></button>
                  </>
                ) : (
                  <button onClick={() => setEditingTask(true)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '6px 10px', color: '#667788', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Pencil size={12} /> Rediger</button>
                )}
                <button
                  onClick={e => toggleDone(e, activeTask)}
                  style={{ background: activeTask.done ? 'rgba(46,204,113,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${activeTask.done ? 'rgba(46,204,113,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 6, padding: '6px 10px', color: activeTask.done ? '#2ECC71' : '#667788', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Check size={12} /> {activeTask.done ? 'Færdig' : 'Marker færdig'}
                </button>
                <button onClick={() => deleteTask(activeTask.id)} style={{ background: 'none', border: '1px solid rgba(232,64,37,0.2)', borderRadius: 6, padding: '6px 8px', color: '#E84025', cursor: 'pointer' }}><Trash2 size={12} /></button>
                <button onClick={() => setActiveTask(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A5568', padding: 2 }}><X size={16} /></button>
              </div>
            </div>

            {/* Detail body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Meta grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {/* Priority */}
                <div>
                  <div style={{ fontSize: 10, color: '#4A5568', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}><Flag size={10} /> Prioritet</div>
                  {editingTask ? (
                    <select value={taskForm.priority || 'medium'} onChange={e => setTaskForm(p => ({ ...p, priority: e.target.value }))} style={{ ...inp, width: '100%' }}>
                      {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 6, background: PRIORITY_CONFIG[activeTask.priority]?.bg, color: PRIORITY_CONFIG[activeTask.priority]?.color }}>
                      {PRIORITY_CONFIG[activeTask.priority]?.label}
                    </span>
                  )}
                </div>

                {/* Due date */}
                <div>
                  <div style={{ fontSize: 10, color: '#4A5568', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={10} /> Deadline</div>
                  {editingTask ? (
                    <input type="date" value={taskForm.due_date || ''} onChange={e => setTaskForm(p => ({ ...p, due_date: e.target.value || null }))} style={{ ...inp, width: '100%', colorScheme: 'dark' }} />
                  ) : (
                    <span style={{ fontSize: 12, color: activeTask.due_date ? (dueDateStyle(activeTask.due_date).color) : '#3A4A5A' }}>
                      {activeTask.due_date ? new Date(activeTask.due_date).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Ingen deadline'}
                    </span>
                  )}
                </div>

                {/* Assigned */}
                <div>
                  <div style={{ fontSize: 10, color: '#4A5568', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}><User size={10} /> Ansvarlig</div>
                  {editingTask ? (
                    <select value={taskForm.assigned_to || ''} onChange={e => setTaskForm(p => ({ ...p, assigned_to: e.target.value || null }))} style={{ ...inp, width: '100%' }}>
                      <option value="">Ingen</option>
                      {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {activeTask.assigned_name ? (
                        <><Avatar name={activeTask.assigned_name} size={20} /><span style={{ fontSize: 12, color: '#B0C0D0' }}>{activeTask.assigned_name}</span></>
                      ) : (
                        <span style={{ fontSize: 12, color: '#3A4A5A' }}>Ikke tildelt</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Column */}
                <div>
                  <div style={{ fontSize: 10, color: '#4A5568', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}><ChevronDown size={10} /> Kolonne</div>
                  {editingTask ? (
                    <select value={taskForm.column_id || activeTask.column_id} onChange={e => setTaskForm(p => ({ ...p, column_id: e.target.value }))} style={{ ...inp, width: '100%' }}>
                      {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : (
                    <span style={{ fontSize: 12, color: '#B0C0D0' }}>{columns.find(c => c.id === activeTask.column_id)?.name}</span>
                  )}
                </div>
              </div>

              {/* Customer */}
              <div>
                <div style={{ fontSize: 10, color: '#4A5568', marginBottom: 5 }}>Kunde</div>
                {editingTask ? (
                  <select value={taskForm.customer_id || ''} onChange={e => setTaskForm(p => ({ ...p, customer_id: e.target.value || null }))} style={{ ...inp, width: '100%' }}>
                    <option value="">Ingen kunde</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
                  </select>
                ) : (
                  <span style={{ fontSize: 12, color: activeTask.customer_company ? '#E84025' : '#3A4A5A' }}>
                    {activeTask.customer_company || 'Ingen kunde'}
                  </span>
                )}
              </div>

              {/* Labels */}
              <div>
                <div style={{ fontSize: 10, color: '#4A5568', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 4 }}><Tag size={10} /> Labels</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 7 }}>
                  {parseLabels(editingTask ? (taskForm.labels || '[]') : activeTask.labels).map(l => (
                    <span key={l} style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, background: labelColor(l) + '22', color: labelColor(l), display: 'flex', alignItems: 'center', gap: 4 }}>
                      {l}
                      {editingTask && (
                        <button onClick={() => { const cur = parseLabels(taskForm.labels || '[]'); setTaskForm(p => ({ ...p, labels: JSON.stringify(cur.filter(x => x !== l)) })); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}><X size={9} /></button>
                      )}
                    </span>
                  ))}
                </div>
                {editingTask && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newLabel.trim()) { const cur = parseLabels(taskForm.labels || '[]'); if (!cur.includes(newLabel.trim())) setTaskForm(p => ({ ...p, labels: JSON.stringify([...cur, newLabel.trim()]) })); setNewLabel(''); } }} placeholder="Ny label + Enter" style={{ ...inp, flex: 1, fontSize: 12 }} />
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <div style={{ fontSize: 10, color: '#4A5568', marginBottom: 5 }}>Beskrivelse</div>
                {editingTask ? (
                  <textarea value={taskForm.description || ''} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} placeholder="Tilføj en beskrivelse..." rows={4} style={{ ...inp, width: '100%', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
                ) : (
                  <div style={{ fontSize: 13, color: activeTask.description ? '#8899AA' : '#3A4A5A', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {activeTask.description || 'Ingen beskrivelse'}
                  </div>
                )}
              </div>

              {/* Comments */}
              <div>
                <div style={{ fontSize: 10, color: '#4A5568', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MessageSquare size={10} /> Kommentarer ({comments.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                  {comments.map(c => (
                    <div key={c.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '9px 11px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                        <Avatar name={c.user_name} size={20} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#B0C0D0' }}>{c.user_name}</span>
                        <span style={{ fontSize: 10, color: '#2D3748', marginLeft: 'auto' }}>
                          {new Date(c.created_at).toLocaleString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: '#8899AA', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.content}</div>
                    </div>
                  ))}
                </div>
                {/* New comment */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <textarea
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postComment(); }}
                    placeholder="Skriv en kommentar... (⌘+Enter)"
                    rows={2}
                    style={{ ...inp, flex: 1, resize: 'none', fontFamily: 'inherit', fontSize: 12 }}
                  />
                  <button onClick={postComment} disabled={!newComment.trim()} style={{ background: newComment.trim() ? '#E84025' : 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 7, padding: '0 14px', color: newComment.trim() ? '#fff' : '#3A4A5A', cursor: newComment.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center' }}>
                    <Check size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Settings panel ───────────────────────────────────────────────── */}
      {showSettings && (
        <>
          <div onClick={() => setShowSettings(false)} style={{ position: 'fixed', inset: 0, zIndex: 198 }} />
          <div style={{ position: 'fixed', top: 54, right: 16, width: 260, background: '#111820', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, zIndex: 199, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, color: '#4A5568', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Board indstillinger</div>
            <button
              onClick={async () => {
                if (!confirm('Slet dette projekt og alle dets opgaver?')) return;
                await fetch(`/api/projects/${id}`, { method: 'DELETE' });
                router.push('/projects');
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 7, border: '1px solid rgba(232,64,37,0.2)', background: 'transparent', color: '#E84025', fontSize: 13, cursor: 'pointer' }}
            >
              <Trash2 size={13} /> Slet projekt
            </button>
          </div>
        </>
      )}
    </div>
  );
}
