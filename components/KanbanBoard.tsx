'use client';

import { useState, useEffect } from 'react';
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

interface Lead {
  id: string;
  company: string;
  contact_name: string;
  contact_title: string;
  priority: string;
  status: string;
  market: string;
  updated_at: string;
  product_names?: string;
  pipeline_value?: number;
}

interface KanbanBoardProps {
  leads: Lead[];
  onUpdateLead: (id: string, changes: Partial<Lead>) => Promise<void>;
  onSelectLead: (lead: Lead) => void;
  columns?: Array<{ id: string; label: string }>;
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

function KanbanCard({ lead, onSelect, isDragging }: {
  lead: Lead;
  onSelect: (l: Lead) => void;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: lead.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

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
          {Number(lead.pipeline_value) > 0 ? (
            <span style={{ fontSize: '10px', color: '#2ECC71', fontWeight: 600 }}>
              {Number(lead.pipeline_value) >= 1000
                ? `${(Number(lead.pipeline_value) / 1000).toFixed(0)}k kr`
                : `${Number(lead.pipeline_value)} kr`}
            </span>
          ) : (
            <span style={{ fontSize: '10px', color: '#667788' }}>—</span>
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ column, leads, onSelect, activeId }: {
  column: { id: string; label: string };
  leads: Lead[];
  onSelect: (l: Lead) => void;
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
              onSelect={onSelect}
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

export default function KanbanBoard({ leads, onUpdateLead, onSelectLead, columns }: KanbanBoardProps) {
  const COLUMNS = columns && columns.length > 0 ? columns : DEFAULT_COLUMNS;
  const [localLeads, setLocalLeads] = useState<Lead[]>(leads);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => { setLocalLeads(leads); }, [leads]);

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
            onSelect={onSelectLead}
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
