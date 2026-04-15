'use client';

import { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import { MarketBadge } from './StatusBadge';
import { UserRound } from 'lucide-react';

interface User {
  id: string;
  name: string;
  role: string;
}

interface Lead {
  id: string;
  company: string;
  contact_name: string;
  contact_title: string;
  priority: string;
  status: string;
  market: string;
  updated_at: string;
  assigned_to?: string | null;
  product_names?: string;
  pipeline_value?: number;
}

interface KanbanBoardProps {
  leads: Lead[];
  onUpdateLead: (id: string, changes: Partial<Lead>) => Promise<void>;
  onSelectLead: (lead: Lead) => void;
  columns?: Array<{ id: string; label: string }>;
  users?: User[];
}

const DEFAULT_COLUMNS: Array<{ id: string; label: string }> = [
  { id: 'new', label: 'Ny' },
  { id: 'contacted', label: 'Kontaktet' },
  { id: 'replied', label: 'Svar' },
  { id: 'interested', label: 'Interesseret' },
  { id: 'booked', label: 'Møde booket' },
  { id: 'won', label: 'Vundet' },
  { id: 'lost', label: 'Tabt' },
];

function daysAgo(dateStr: string): number {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

// Colour palette — each user gets a consistent colour based on index
const USER_COLORS = ['#185FA5', '#2ECC71', '#E67E22', '#9B59B6', '#E84025', '#1ABC9C'];

function AssignButton({ lead, users, onAssign }: {
  lead: Lead;
  users: User[];
  onAssign: (leadId: string, userId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const assigned = users.find(u => u.id === lead.assigned_to);
  const colorIdx = assigned ? users.indexOf(assigned) % USER_COLORS.length : -1;
  const color = colorIdx >= 0 ? USER_COLORS[colorIdx] : '#334455';

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        title={assigned ? `Tildelt: ${assigned.name}` : 'Tildel til sælger'}
        style={{
          width: 22, height: 22, borderRadius: '50%',
          background: assigned ? `${color}30` : 'rgba(255,255,255,0.06)',
          border: `1.5px solid ${assigned ? color : 'rgba(255,255,255,0.12)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0, padding: 0,
        }}
      >
        {assigned ? (
          <span style={{ fontSize: '9px', fontWeight: 700, color }}>{assigned.name.charAt(0).toUpperCase()}</span>
        ) : (
          <UserRound size={10} color="#445566" />
        )}
      </button>

      {open && (
        <div
          onPointerDown={e => e.stopPropagation()}
          style={{
            position: 'absolute', bottom: '100%', right: 0, marginBottom: '4px',
            background: '#1A2A38', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px', padding: '5px', zIndex: 500,
            minWidth: '150px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          {/* Unassign option */}
          <div
            onClick={e => { e.stopPropagation(); onAssign(lead.id, null); setOpen(false); }}
            style={{
              padding: '5px 8px', borderRadius: '5px', fontSize: '11px',
              color: '#556677', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <UserRound size={11} /> Ingen tildeling
          </div>
          {users.map((u, i) => {
            const c = USER_COLORS[i % USER_COLORS.length];
            const isActive = lead.assigned_to === u.id;
            return (
              <div
                key={u.id}
                onClick={e => { e.stopPropagation(); onAssign(lead.id, u.id); setOpen(false); }}
                style={{
                  padding: '5px 8px', borderRadius: '5px', cursor: 'pointer',
                  background: isActive ? `${c}18` : 'transparent',
                  display: 'flex', alignItems: 'center', gap: '7px',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: `${c}25`, border: `1.5px solid ${c}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '9px', fontWeight: 700, color: c, flexShrink: 0,
                }}>
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: isActive ? '#ECF0F1' : '#AAB8C8', fontWeight: isActive ? 600 : 400 }}>{u.name}</div>
                  <div style={{ fontSize: '9px', color: '#445566', textTransform: 'uppercase' }}>{u.role === 'admin' ? 'Admin' : 'Sælger'}</div>
                </div>
                {isActive && <span style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: c, flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KanbanCard({ lead, users, onSelect, onAssign, isDragging }: {
  lead: Lead;
  users: User[];
  onSelect: (l: Lead) => void;
  onAssign: (leadId: string, userId: string | null) => void;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: lead.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        onClick={() => onSelect(lead)}
        style={{
          background: '#1A2A38', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '8px', padding: '10px 12px', cursor: 'grab',
          marginBottom: '6px', userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#ECF0F1', flex: 1, marginRight: '6px', lineHeight: 1.3 }}>
            {lead.company}
          </div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
            {lead.priority === 'high' && (
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#E74C3C', display: 'inline-block' }} />
            )}
            <MarketBadge market={lead.market} />
          </div>
        </div>
        <div style={{ fontSize: '11px', color: '#667788', lineHeight: 1.3 }}>
          {lead.contact_name}{lead.contact_title ? ` · ${lead.contact_title}` : ''}
        </div>
        {lead.product_names && (
          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '6px' }}>
            {lead.product_names.split(', ').map(n => (
              <span key={n} style={{
                fontSize: '9px', fontWeight: 500, padding: '1px 5px', borderRadius: '3px',
                background: 'rgba(24,95,165,0.15)', color: '#185FA5',
                border: '1px solid rgba(24,95,165,0.2)',
              }}>{n}</span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          <span style={{ fontSize: '10px', color: '#667788' }}>
            {daysAgo(lead.updated_at)}d i status
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {Number(lead.pipeline_value) > 0 && (
              <span style={{ fontSize: '10px', color: '#2ECC71', fontWeight: 600 }}>
                {Number(lead.pipeline_value) >= 1000
                  ? `${(Number(lead.pipeline_value) / 1000).toFixed(0)}k kr`
                  : `${Number(lead.pipeline_value)} kr`}
              </span>
            )}
            {users.length > 0 && (
              <AssignButton lead={lead} users={users} onAssign={onAssign} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ column, leads, users, onSelect, onAssign, activeId }: {
  column: { id: string; label: string };
  leads: Lead[];
  users: User[];
  onSelect: (l: Lead) => void;
  onAssign: (leadId: string, userId: string | null) => void;
  activeId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div style={{
      background: isOver ? 'rgba(24,95,165,0.06)' : '#111E2A',
      border: `1px solid ${isOver ? 'rgba(24,95,165,0.5)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: '10px', minWidth: '180px', maxWidth: '200px', flexShrink: 0,
      display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 260px)',
      transition: 'border-color 0.15s, background 0.15s',
    }}>
      <div style={{
        padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#ECF0F1' }}>{column.label}</span>
          <span style={{
            background: 'rgba(255,255,255,0.08)', borderRadius: '100px',
            padding: '1px 6px', fontSize: '11px', color: '#667788',
          }}>{leads.length}</span>
        </div>
        <span style={{ fontSize: '10px', color: '#667788' }}>
          {(() => {
            const total = leads.reduce((s, l) => s + (Number(l.pipeline_value) || 0), 0);
            return total > 0 ? `${(total / 1000).toFixed(0)}k kr` : '—';
          })()}
        </span>
      </div>
      <div ref={setNodeRef} style={{ overflowY: 'auto', padding: '8px', flex: 1, minHeight: '60px' }}>
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map(lead => (
            <KanbanCard
              key={lead.id}
              lead={lead}
              users={users}
              onSelect={onSelect}
              onAssign={onAssign}
              isDragging={activeId === lead.id}
            />
          ))}
        </SortableContext>
        {leads.length === 0 && (
          <div style={{ padding: '16px', textAlign: 'center', color: '#667788', fontSize: '11px' }}>
            Ingen leads
          </div>
        )}
      </div>
    </div>
  );
}

export default function KanbanBoard({ leads, onUpdateLead, onSelectLead, columns, users = [] }: KanbanBoardProps) {
  const COLUMNS = columns && columns.length > 0 ? columns : DEFAULT_COLUMNS;
  const [localLeads, setLocalLeads] = useState<Lead[]>(leads);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => { setLocalLeads(leads); }, [leads]);

  const handleAssign = async (leadId: string, userId: string | null) => {
    setLocalLeads(prev => prev.map(l => l.id === leadId ? { ...l, assigned_to: userId } : l));
    const user = users.find(u => u.id === userId);
    toast.success(userId ? `Tildelt: ${user?.name ?? 'sælger'}` : 'Tildeling fjernet');
    await onUpdateLead(leadId, { assigned_to: userId }).catch(() => {
      setLocalLeads(prev => prev.map(l => l.id === leadId ? { ...l, assigned_to: leads.find(o => o.id === leadId)?.assigned_to } : l));
      toast.error('Fejl ved tildeling');
    });
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const activeLead = localLeads.find(l => l.id === activeId);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const lead = localLeads.find(l => l.id === active.id);
    if (!lead) return;

    const targetStatus =
      COLUMNS.find(c => c.id === over.id)?.id ||
      localLeads.find(l => l.id === over.id)?.status;

    if (!targetStatus || targetStatus === lead.status) return;

    setLocalLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: targetStatus } : l));
    const colLabel = COLUMNS.find(c => c.id === targetStatus)?.label || targetStatus;
    toast.success(`${lead.company} → ${colLabel}`);

    onUpdateLead(lead.id, { status: targetStatus }).catch(() => {
      setLocalLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: lead.status } : l));
      toast.error('Fejl ved opdatering');
    });
  }

  const visibleLeads = localLeads.filter(l => l.status !== 'deleted');

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            column={col}
            leads={visibleLeads.filter(l => l.status === col.id)}
            users={users}
            onSelect={onSelectLead}
            onAssign={handleAssign}
            activeId={activeId}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead && (
          <div style={{
            background: '#1A2A38', border: '1px solid #185FA5',
            borderRadius: '8px', padding: '10px 12px',
            transform: 'rotate(2deg)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            width: '180px',
          }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#ECF0F1' }}>{activeLead.company}</div>
            <div style={{ fontSize: '11px', color: '#667788', marginTop: '2px' }}>{activeLead.contact_name}</div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
