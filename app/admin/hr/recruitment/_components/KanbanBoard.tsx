'use client';

import { useState } from 'react';
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay,
  PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable,
} from '@dnd-kit/core';
import { STAGES, COLLAPSED_STAGES_DEFAULT, fmtDateShort, fmtDatetime, daysUntil, sourceLabel, initials, avatarColor } from '@/lib/recruitment';
import type { Candidate } from './types';

export default function KanbanBoard({ candidates, onOpen, onStageChange }: {
  candidates: Candidate[];
  onOpen: (id: number) => void;
  onStageChange: (id: number, stage: string, rejectionReason?: string | null) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(COLLAPSED_STAGES_DEFAULT));
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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

    if (newStage === 'stoppet') {
      const reason = window.prompt('Årsag til stop? (valgfrit)') ?? '';
      onStageChange(candidateId, newStage, reason || null);
    } else {
      onStageChange(candidateId, newStage);
    }
  }

  const byStage = (key: string) => candidates.filter(c => c.stage === key);
  const activeDragging = activeId ? candidates.find(c => c.id === Number(activeId)) : null;
  const activeStageColor = activeDragging ? (STAGES.find(s => s.key === activeDragging.stage)?.color ?? 'var(--bl)') : 'var(--bl)';

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ display: 'flex', gap: 0, flex: 1, overflow: 'auto', padding: '16px 24px 24px' }}>
        {STAGES.map(stage => {
          const cards = byStage(stage.key);
          const isCollapsed = collapsed.has(stage.key);
          const canCollapse = COLLAPSED_STAGES_DEFAULT.includes(stage.key);
          return (
            <div key={stage.key} style={{ width: 232, flexShrink: 0, marginRight: 10, display: 'flex', flexDirection: 'column' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, cursor: canCollapse ? 'pointer' : 'default', userSelect: 'none' }}
                onClick={canCollapse ? () => setCollapsed(prev => {
                  const next = new Set(prev);
                  if (next.has(stage.key)) next.delete(stage.key); else next.add(stage.key);
                  return next;
                }) : undefined}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--t2)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{stage.label}</span>
                <span style={{ fontSize: 10, color: 'var(--t3)', marginLeft: 2 }}>{cards.length}</span>
                {canCollapse && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--t3)' }}>{isCollapsed ? '▸' : '▾'}</span>}
              </div>

              {!isCollapsed ? (
                <DroppableColumn stageKey={stage.key}>
                  {cards.map(c => (
                    <DraggableCard key={c.id} candidate={c} stageColor={stage.color} onClick={() => onOpen(c.id)} />
                  ))}
                  {cards.length === 0 && (
                    <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 11, color: 'var(--t3)', opacity: 0.5 }}>Tom</div>
                  )}
                </DroppableColumn>
              ) : (
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

      <DragOverlay>
        {activeDragging && (
          <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 9, padding: '10px 12px', width: 222, borderLeft: `3px solid ${activeStageColor}`, boxShadow: '0 12px 36px rgba(0,0,0,0.5)', cursor: 'grabbing' }}>
            <CandidateCardInner candidate={activeDragging} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function DroppableColumn({ stageKey, children }: { stageKey: string; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: stageKey });
  return (
    <div ref={setNodeRef} style={{ flex: 1, minHeight: 100, borderRadius: 8, transition: 'background 0.1s', background: isOver ? 'rgba(79,142,247,0.06)' : 'transparent' }}>
      {children}
    </div>
  );
}

function DraggableCard({ candidate, stageColor, onClick }: { candidate: Candidate; stageColor: string; onClick: () => void }) {
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
  const interviewOverdue = candidate.interview_date && new Date(candidate.interview_date).getTime() < Date.now();
  const startDays = daysUntil(candidate.start_date);
  const startSoon = startDays !== null && startDays <= 14;
  const checklistPct = candidate.checklist_total > 0 ? Math.round((candidate.checklist_done / candidate.checklist_total) * 100) : 0;

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
        {candidate.source && (
          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'var(--t2)' }}>
            {sourceLabel(candidate.source)}
          </span>
        )}
      </div>

      {candidate.stage === 'samtale_booket' && candidate.interview_date && (
        <div style={{ fontSize: 10, color: interviewOverdue ? 'var(--re)' : 'var(--pu)', marginBottom: 4 }}>
          📅 {fmtDatetime(candidate.interview_date)}
        </div>
      )}
      {candidate.stage === 'ansat' && candidate.start_date && (
        <div style={{ fontSize: 10, color: startSoon ? 'var(--or)' : 'var(--gr)', marginBottom: 4 }}>
          🗓 {startDays !== null && startDays >= 0 ? `Starter om ${startDays} ${startDays === 1 ? 'dag' : 'dage'}` : `Starter ${fmtDateShort(candidate.start_date)}`}
        </div>
      )}
      {candidate.stage === 'ansat' && candidate.checklist_total > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10, color: candidate.checklist_overdue ? 'var(--re)' : 'var(--t2)', marginBottom: 3 }}>
            ✓ {candidate.checklist_done}/{candidate.checklist_total} opgaver
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--s3)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${checklistPct}%`, background: candidate.checklist_overdue ? 'var(--re)' : 'var(--gr)' }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {candidate.comment_count > 0 && <span style={{ fontSize: 10, color: 'var(--t3)' }}>💬 {candidate.comment_count}</span>}
        <span style={{ fontSize: 10, color: 'var(--t3)' }}>{candidate.days_in_stage} {candidate.days_in_stage === 1 ? 'dag' : 'dage'}</span>
        {candidate.assigned_to_name && (
          <div title={candidate.assigned_to_name} style={{
            marginLeft: 'auto', width: 18, height: 18, borderRadius: 5,
            background: `${avatarColor(candidate.assigned_to_name)}22`, border: `1px solid ${avatarColor(candidate.assigned_to_name)}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8, fontWeight: 800, color: avatarColor(candidate.assigned_to_name), flexShrink: 0,
          }}>
            {initials(candidate.assigned_to_name)}
          </div>
        )}
      </div>
    </>
  );
}
