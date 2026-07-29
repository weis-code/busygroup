'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  useDroppable, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { flag } from '@/lib/countries';
import type { Stage, Lead } from './_components/types';
import { fmt, fmtDate, isOverdue, daysInStage, MERIDIAN_PRODUCTS, INDUSTRIES } from './_components/types';
import LeadPanel from './_components/LeadPanel';

const PRESET_COLORS = ['#4a5d78','#4f8ef7','#a78bfa','#f59e0b','#ff6b35','#2dd4a0','#f43f5e','#06b6d4'];

/* ── Stage editor modal ──────────────────────────────── */
function StageEditorModal({ stages: initial, onClose, onSaved }: {
  stages: Stage[]; onClose: () => void; onSaved: () => void;
}) {
  const [stages, setStages]   = useState<Stage[]>(initial);
  const [saving, setSaving]   = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#4f8ef7');
  const [newProb, setNewProb] = useState('50');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [migrateStageId, setMigrateStageId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleEditorDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = stages.findIndex(s => s.id === Number(active.id));
    const newIdx = stages.findIndex(s => s.id === Number(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    setStages(arrayMove(stages, oldIdx, newIdx));
  }

  function updateStage(id: number, patch: Partial<Stage>) {
    setStages(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }

  async function addStage() {
    if (!newName.trim()) return;
    const res = await fetch('/api/meridian/crm/stages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), color: newColor, probability: Number(newProb) || 50 }),
    });
    const created = await res.json() as Stage;
    setStages(prev => [...prev, created]);
    setNewName(''); setNewColor('#4f8ef7'); setNewProb('50');
  }

  async function deleteStage(id: number) {
    if (migrateStageId === null) return;
    await fetch(`/api/meridian/crm/stages/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ move_leads_to_stage_id: migrateStageId }),
    });
    setStages(prev => prev.filter(s => s.id !== id));
    setDeleteConfirm(null); setMigrateStageId(null);
  }

  async function save() {
    setSaving(true);
    // Save order and metadata for each stage
    const order = stages.map(s => s.id);
    await fetch('/api/meridian/crm/stages/reorder', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    });
    for (const s of stages) {
      await fetch(`/api/meridian/crm/stages/${s.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: s.name, color: s.color, probability: s.probability }),
      });
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  const normalStages = stages.filter(s => !s.is_won && !s.is_lost);
  const specialStages = stages.filter(s => s.is_won || s.is_lost);
  const allIds = normalStages.map(s => s.id);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, width: 520, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>Rediger pipeline</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleEditorDragEnd}>
            <SortableContext items={allIds} strategy={verticalListSortingStrategy}>
              {normalStages.map(stage => (
                <SortableStageRow key={stage.id} stage={stage}
                  onUpdateName={n => updateStage(stage.id, { name: n })}
                  onUpdateColor={c => updateStage(stage.id, { color: c })}
                  onUpdateProb={p => updateStage(stage.id, { probability: p })}
                  onDelete={() => { setDeleteConfirm(stage.id); setMigrateStageId(stages.filter(s => s.id !== stage.id && !s.is_lost)[0]?.id ?? null); }}
                  deleteConfirm={deleteConfirm === stage.id}
                  onCancelDelete={() => setDeleteConfirm(null)}
                  onConfirmDelete={() => void deleteStage(stage.id)}
                  migrateStageId={migrateStageId}
                  onMigrateChange={setMigrateStageId}
                  migrationOptions={stages.filter(s => s.id !== stage.id && !s.is_lost)}
                />
              ))}
            </SortableContext>
          </DndContext>

          {specialStages.length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--bd)' }}>
              {specialStages.map(stage => (
                <SortableStageRow key={stage.id} stage={stage}
                  onUpdateName={n => updateStage(stage.id, { name: n })}
                  onUpdateColor={c => updateStage(stage.id, { color: c })}
                  onUpdateProb={p => updateStage(stage.id, { probability: p })}
                  onDelete={() => {}} deleteConfirm={false}
                  onCancelDelete={() => {}} onConfirmDelete={() => {}}
                  migrateStageId={null} onMigrateChange={() => {}} migrationOptions={[]}
                  isSpecial
                />
              ))}
            </div>
          )}

          {/* Add new stage */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--bd)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', marginBottom: 8 }}>+ TILFØJ STADIE</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Navn…"
                style={{ flex: 1, fontSize: 12, padding: '6px 9px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 6, color: 'var(--t1)' }} />
              <input value={newProb} onChange={e => setNewProb(e.target.value)} type="number" min="0" max="100" placeholder="%"
                style={{ width: 54, fontSize: 12, padding: '6px 9px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 6, color: 'var(--t1)' }} />
              <div style={{ display: 'flex', gap: 3 }}>
                {PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => setNewColor(c)} style={{ width: 16, height: 16, borderRadius: '50%', background: c, border: `2px solid ${newColor === c ? 'var(--t1)' : 'transparent'}`, cursor: 'pointer', padding: 0 }} />
                ))}
              </div>
              <button onClick={() => void addStage()} disabled={!newName.trim()}
                style={{ background: 'var(--bl)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: newName.trim() ? 1 : 0.5 }}>
                Tilføj
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 8 }}>
          <button onClick={() => void save()} disabled={saving}
            style={{ flex: 1, background: 'var(--bl)', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? 'Gemmer…' : 'Gem ændringer'}
          </button>
          <button onClick={onClose} style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 13, color: 'var(--t2)', cursor: 'pointer' }}>Annuller</button>
        </div>
      </div>
    </div>
  );
}

function SortableStageRow({ stage, onUpdateName, onUpdateColor, onUpdateProb, onDelete, deleteConfirm, onCancelDelete, onConfirmDelete, migrateStageId, onMigrateChange, migrationOptions, isSpecial }: {
  stage: Stage; onUpdateName: (n: string) => void; onUpdateColor: (c: string) => void;
  onUpdateProb: (p: number) => void; onDelete: () => void; deleteConfirm: boolean;
  onCancelDelete: () => void; onConfirmDelete: () => void; migrateStageId: number | null;
  onMigrateChange: (id: number) => void; migrationOptions: Stage[]; isSpecial?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [nameVal, setNameVal] = useState(stage.name);
  const [probVal, setProbVal] = useState(String(stage.probability));

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id, disabled: !!isSpecial });

  function commitName() { if (nameVal.trim()) onUpdateName(nameVal.trim()); setEditing(false); }
  function commitProb() { const n = Number(probVal); if (!isNaN(n)) onUpdateProb(Math.min(100, Math.max(0, n))); }

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--bd)', opacity: isSpecial ? 0.7 : 1 }}>
        {/* Drag handle */}
        <span {...(isSpecial ? {} : { ...attributes, ...listeners })} style={{ cursor: isSpecial ? 'default' : 'grab', color: 'var(--t3)', fontSize: 14, flexShrink: 0, userSelect: 'none' }}>⋮⋮</span>

        {/* Color picker */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button style={{ width: 14, height: 14, borderRadius: '50%', background: stage.color, border: '2px solid rgba(255,255,255,0.2)', cursor: 'pointer', padding: 0 }}
            onClick={() => setShowColors(v => !v)} title="Vælg farve" />
          {showColors && (
            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10, display: 'flex', gap: 3, background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 6, padding: 5, marginTop: 3, flexWrap: 'wrap', width: 88 }}>
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => { onUpdateColor(c); setShowColors(false); }} style={{ width: 14, height: 14, borderRadius: '50%', background: c, border: `2px solid ${stage.color === c ? 'var(--t1)' : 'transparent'}`, cursor: 'pointer', padding: 0 }} />
              ))}
            </div>
          )}
        </div>

        {/* Name */}
        {editing ? (
          <input autoFocus value={nameVal} onChange={e => setNameVal(e.target.value)}
            onBlur={commitName} onKeyDown={e => e.key === 'Enter' && commitName()}
            style={{ flex: 1, fontSize: 12, padding: '3px 6px', background: 'var(--s2)', border: '1px solid var(--bl)', borderRadius: 5, color: 'var(--t1)' }} />
        ) : (
          <span onClick={() => setEditing(true)} style={{ flex: 1, fontSize: 12, color: 'var(--t1)', cursor: 'text' }}>{stage.name}</span>
        )}

        {/* Probability */}
        <input value={probVal} onChange={e => setProbVal(e.target.value)} onBlur={commitProb} type="number" min="0" max="100"
          style={{ width: 46, fontSize: 11, padding: '3px 5px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 5, color: 'var(--t2)', textAlign: 'center' }} />
        <span style={{ fontSize: 10, color: 'var(--t3)' }}>%</span>

        {!isSpecial && (
          <button onClick={onDelete} style={{ background: 'none', border: 'none', color: 'var(--re)', cursor: 'pointer', fontSize: 11, padding: '2px 6px', borderRadius: 5, flexShrink: 0 }}>Slet</button>
        )}
      </div>

      {deleteConfirm && (
        <div style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 7, padding: '10px 12px', marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--re)', fontWeight: 600, marginBottom: 6 }}>Flyt leads til:</div>
          <select value={migrateStageId ?? ''} onChange={e => onMigrateChange(Number(e.target.value))}
            style={{ fontSize: 11, padding: '5px 8px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 6, color: 'var(--t1)', marginBottom: 8, width: '100%' }}>
            {migrationOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onConfirmDelete} style={{ flex: 1, background: 'var(--re)', color: '#fff', border: 'none', borderRadius: 5, padding: '5px 0', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Slet stadie</button>
            <button onClick={onCancelDelete} style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 5, padding: '5px 10px', fontSize: 11, color: 'var(--t2)', cursor: 'pointer' }}>Annuller</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sortable lead card ──────────────────────────────── */
function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });
  const overdue  = isOverdue(lead.next_action_date);
  const soonDue  = !overdue && lead.next_action_date && lead.next_action_date <= new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }} {...attributes} {...listeners}>
      <div onClick={onClick} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 8, padding: '10px 12px', marginBottom: 6, cursor: 'pointer', transition: 'border-color 0.1s' }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--bd2)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--bd)')}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>{lead.company_name}</div>
        {lead.contact_name && <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>{lead.contact_name}{lead.contact_title ? ` · ${lead.contact_title}` : ''}</div>}
        {(lead.products as string[] ?? []).length > 0 && (
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
            {(lead.products as string[]).map((p: string) => (
              <span key={p} style={{ fontSize: 9, padding: '2px 5px', background: 'var(--bl2)', borderRadius: 100, color: 'var(--bl)', fontWeight: 600 }}>{p}</span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {lead.deal_value_dkk > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gr)' }}>{fmt(lead.deal_value_dkk)}/md.</span>}
          {lead.country && lead.country !== 'DK' && <span style={{ fontSize: 11 }}>{flag(lead.country)}</span>}
          <span style={{ fontSize: 9, color: 'var(--t3)', marginLeft: 'auto' }}>{daysInStage(lead.updated_at)} dage</span>
          {Number(lead.activity_count) > 0 && <span style={{ fontSize: 9, color: 'var(--t3)' }}>💬 {lead.activity_count}</span>}
        </div>
        {lead.next_action_label && (
          <div style={{ marginTop: 4, fontSize: 10, color: overdue ? 'var(--re)' : soonDue ? 'var(--ye)' : 'var(--t3)', fontWeight: overdue || soonDue ? 600 : 400 }}>
            📅 {lead.next_action_label}{lead.next_action_date ? ` · ${fmtDate(lead.next_action_date)}` : ''}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Stage column with droppable support ─────────────── */
function StageColumn({ stage, leads, onCardClick, collapsed, onToggle }: {
  stage: Stage; leads: Lead[]; onCardClick: (id: number) => void;
  collapsed?: boolean; onToggle?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'stage-' + stage.id });
  const ids = leads.map(l => l.id);
  const totalValue = leads.reduce((s, l) => s + (Number(l.deal_value_dkk) || 0), 0);

  return (
    <div style={{ width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: collapsed ? 0 : 8, padding: '0 2px', cursor: onToggle ? 'pointer' : 'default' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: stage.color, display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--t1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stage.name}</span>
        <span style={{ fontSize: 10, color: 'var(--t3)', background: 'var(--s2)', border: '1px solid var(--bd)', padding: '1px 6px', borderRadius: 100, flexShrink: 0 }}>{leads.length}</span>
        {onToggle && <span style={{ fontSize: 10, color: 'var(--t3)', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.15s' }}>▾</span>}
      </div>
      {!collapsed && (
        <>
          {totalValue > 0 && <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 6, paddingLeft: 17 }}>{fmt(totalValue)}/md.</div>}
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div ref={setNodeRef} data-stage-id={stage.id}
              style={{ flex: 1, minHeight: 80, borderRadius: 7, border: '1px dashed transparent', transition: 'all 0.1s', ...(isOver ? { borderColor: 'var(--bl)', background: 'rgba(79,142,247,0.04)' } : {}) }}>
              {leads.map(l => <LeadCard key={l.id} lead={l} onClick={() => onCardClick(l.id)} />)}
              {leads.length === 0 && <div style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'center', padding: '16px 0', opacity: 0.5 }}>Tom</div>}
            </div>
          </SortableContext>
        </>
      )}
    </div>
  );
}

/* ── New Lead Modal ──────────────────────────────────── */
function NewLeadModal({ stages, onClose, onCreated }: { stages: Stage[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ company_name: '', contact_name: '', contact_title: '', email: '', phone: '', linkedin: '', website: '', country: 'DK', industry: '', stage_id: stages[0]?.id ?? 0, products: [] as string[], deal_value_dkk: '', deal_type: 'recurring', expected_close_date: '', probability: stages[0]?.probability ?? 0, notes: '' });
  const [saving, setSaving] = useState(false);

  function toggle(product: string) {
    setForm(f => ({ ...f, products: f.products.includes(product) ? f.products.filter(p => p !== product) : [...f.products, product] }));
  }

  async function submit() {
    if (!form.company_name.trim() || saving) return;
    setSaving(true);
    await fetch('/api/meridian/crm/leads', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, deal_value_dkk: Number(form.deal_value_dkk) || 0 }),
    });
    setSaving(false);
    onCreated();
    onClose();
  }

  const s = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '24px 28px', width: 560, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 20 }}>Nyt lead</div>
        <Section label="VIRKSOMHED">
          <Field label="Firmanavn *"><input value={form.company_name} onChange={s('company_name')} placeholder="Firmanavn…" /></Field>
          <Field label="Website"><input value={form.website} onChange={s('website')} placeholder="https://…" /></Field>
          <Field label="Industri">
            <select value={form.industry} onChange={s('industry')}>
              <option value="">Vælg industri…</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </Field>
        </Section>
        <Section label="KONTAKT">
          <Field label="Navn"><input value={form.contact_name} onChange={s('contact_name')} placeholder="Kontaktperson…" /></Field>
          <Field label="Stilling"><input value={form.contact_title} onChange={s('contact_title')} placeholder="CEO, Direktør…" /></Field>
          <Field label="Email"><input value={form.email} onChange={s('email')} type="email" placeholder="email@firma.dk" /></Field>
          <Field label="Telefon"><input value={form.phone} onChange={s('phone')} placeholder="+45…" /></Field>
        </Section>
        <Section label="DEAL">
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', marginBottom: 6 }}>PRODUKTER</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {MERIDIAN_PRODUCTS.map(p => (
                <button key={p} type="button" onClick={() => toggle(p)}
                  style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--bd)', background: form.products.includes(p) ? 'var(--bl2)' : 'var(--s2)', color: form.products.includes(p) ? 'var(--bl)' : 'var(--t2)', cursor: 'pointer', fontWeight: form.products.includes(p) ? 700 : 400 }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <Field label="Værdi (kr./md.)"><input value={form.deal_value_dkk} onChange={s('deal_value_dkk')} type="number" placeholder="0" /></Field>
          <Field label="Stadie">
            <select value={form.stage_id} onChange={e => { const st = stages.find(stg => stg.id === Number(e.target.value)); setForm(f => ({ ...f, stage_id: Number(e.target.value), probability: st?.probability ?? 0 })); }}>
              {stages.map(stg => <option key={stg.id} value={stg.id}>{stg.name}</option>)}
            </select>
          </Field>
          <Field label="Forventet lukning"><input value={form.expected_close_date} onChange={s('expected_close_date')} type="date" /></Field>
        </Section>
        <Section label="NOTER">
          <textarea value={form.notes} onChange={s('notes')} rows={3} placeholder="Fritekst…" style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '7px 9px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 6, color: 'var(--t1)', resize: 'vertical' }} />
        </Section>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={() => void submit()} disabled={!form.company_name.trim() || saving}
            style={{ flex: 1, background: 'var(--bl)', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? 'Opretter…' : 'Opret lead'}
          </button>
          <button onClick={onClose} style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '9px 16px', fontSize: 13, color: 'var(--t2)', cursor: 'pointer' }}>Annuller</button>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 3 }}>{label}</div>
      <style>{`.mcrm-field input,.mcrm-field select{width:100%;padding:7px 9px;background:var(--s2);border:1px solid var(--bd);border-radius:6px;color:var(--t1);font-size:12px;box-sizing:border-box}`}</style>
      <div className="mcrm-field">{children}</div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────── */
export default function MeridianCrmPage() {
  const [stages, setStages]     = useState<Stage[]>([]);
  const [leads, setLeads]       = useState<Lead[]>([]);
  const [overview, setOverview] = useState<{ pipelineValue: number; weightedPipeline: number; wonThisMonth: { count: number; value: number }; activitiesThisWeek: number; leadsByStage: Array<{ id: number; name: string; lead_count: number; total_value: number }> } | null>(null);
  const [search, setSearch]     = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<number | null>(null);
  const [showNewLead, setShowNewLead]   = useState(false);
  const [showEditor, setShowEditor]     = useState(false);
  const [collapsedCols, setCollapsedCols] = useState<Set<number>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const loadStages = useCallback(async () => {
    const res = await fetch('/api/meridian/crm/stages');
    if (!res.ok) {
      setLoadError('Pipeline kunne ikke indlæses. Prøv at genindlæse siden.');
      return;
    }
    const data = await res.json() as Stage[];
    const arr = Array.isArray(data) ? data : [];
    setLoadError(null);
    if (arr.length === 0) {
      const seedRes = await fetch('/api/meridian/crm/stages/seed', { method: 'POST' });
      if (!seedRes.ok) {
        setLoadError('Pipeline-stadier kunne ikke oprettes. Prøv at genindlæse siden.');
        return;
      }
      const seededRes = await fetch('/api/meridian/crm/stages');
      if (!seededRes.ok) { setLoadError('Pipeline kunne ikke indlæses. Prøv at genindlæse siden.'); return; }
      const seeded = await seededRes.json() as Stage[];
      setStages(Array.isArray(seeded) ? seeded : []);
      const wl = (Array.isArray(seeded) ? seeded : []).filter((s: Stage) => s.is_won || s.is_lost).map((s: Stage) => s.id);
      setCollapsedCols(new Set(wl));
    } else {
      setStages(arr);
      setCollapsedCols(prev => {
        if (prev.size > 0) return prev;
        const wl = arr.filter(s => s.is_won || s.is_lost).map(s => s.id);
        return new Set(wl);
      });
    }
  }, []);

  const loadLeads = useCallback(async () => {
    const url = search ? `/api/meridian/crm/leads?search=${encodeURIComponent(search)}` : '/api/meridian/crm/leads';
    const data = await fetch(url).then(r => r.json()) as Lead[];
    setLeads(Array.isArray(data) ? data : []);
  }, [search]);

  const loadOverview = useCallback(async () => {
    const data = await fetch('/api/meridian/crm/overview').then(r => r.json());
    setOverview(data);
  }, []);

  useEffect(() => { void loadStages(); void loadLeads(); void loadOverview(); }, [loadStages, loadLeads, loadOverview]);

  function toggleCollapse(stageId: number) {
    setCollapsedCols(prev => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId); else next.add(stageId);
      return next;
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const leadId = Number(active.id);
    if (!leadId) return;

    // over.id is 'stage-N' when dropped on empty column, or a lead id number when dropped on a card
    const overStr = String(over.id);
    let targetStageId: number | null = null;
    if (overStr.startsWith('stage-')) {
      targetStageId = Number(overStr.slice(6));
    } else {
      const overLead = leads.find(l => l.id === Number(over.id));
      targetStageId = overLead?.stage_id ?? null;
    }
    if (targetStageId === null) return;
    const sourceLead = leads.find(l => l.id === leadId);
    if (sourceLead?.stage_id === targetStageId) return;
    const targetStage = stages.find(s => s.id === targetStageId);
    if (!targetStage) return;

    // Optimistic update
    setLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, stage_id: targetStage.id, stage_name: targetStage.name, stage_color: targetStage.color } : l
    ));
    await fetch(`/api/meridian/crm/leads/${leadId}/stage`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage_id: targetStage.id }),
    }).catch(() => void loadLeads());
    void loadOverview();
  }

  async function assignStage(leadId: number, stageId: number) {
    await fetch(`/api/meridian/crm/leads/${leadId}/stage`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage_id: stageId }),
    });
    await loadLeads();
    void loadOverview();
  }

  const activeStages = stages.filter(s => !s.is_won && !s.is_lost);
  const wonLostStages = stages.filter(s => s.is_won || s.is_lost);
  const unassignedLeads = leads.filter(l => l.stage_id === null);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ flexShrink: 0, background: 'var(--s1)', borderBottom: '1px solid var(--bd)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>Min Pipeline</div>
        {overview && <div style={{ fontSize: 12, color: 'var(--t3)' }}>Vægtet: <strong style={{ color: 'var(--bl)' }}>{fmt(overview.weightedPipeline)}</strong></div>}
        <div style={{ flex: 1 }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Søg firma eller kontakt…"
          style={{ fontSize: 12, padding: '6px 10px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 7, color: 'var(--t1)', width: 200 }} />
        <button onClick={() => setShowEditor(true)}
          style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}>
          Rediger pipeline
        </button>
        <button onClick={() => setShowNewLead(true)}
          style={{ background: 'var(--bl)', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Nyt lead
        </button>
      </div>

      {/* Error banner */}
      {loadError && (
        <div style={{ flexShrink: 0, background: 'rgba(244,63,94,0.08)', borderBottom: '1px solid rgba(244,63,94,0.2)', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--re)', fontWeight: 600 }}>⚠ {loadError}</span>
          <button onClick={() => { setLoadError(null); void loadStages(); void loadLeads(); void loadOverview(); }}
            style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 10px', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 6, color: 'var(--re)', cursor: 'pointer' }}>
            Prøv igen
          </button>
        </div>
      )}

      {/* Stats strip */}
      {overview && (
        <div style={{ flexShrink: 0, background: 'var(--s1)', borderBottom: '1px solid var(--bd)', padding: '10px 24px', display: 'flex', gap: 10 }}>
          {[
            { label: 'Pipeline',     value: fmt(overview.pipelineValue),     color: 'var(--t1)' },
            { label: 'Vægtet',       value: fmt(overview.weightedPipeline),  color: 'var(--bl)' },
            { label: 'Vundet md.',   value: `${overview.wonThisMonth.count} · ${fmt(overview.wonThisMonth.value)}`, color: 'var(--gr)' },
            { label: 'Akt. i uge',   value: String(overview.activitiesThisWeek), color: 'var(--pu)' },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '7px 12px', flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>{k.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Leads without a stage — recovery banner for a previous bug that orphaned leads on stage deletion */}
      {unassignedLeads.length > 0 && (
        <div style={{ flexShrink: 0, background: 'rgba(245,158,11,0.06)', borderBottom: '1px solid rgba(245,158,11,0.2)', padding: '10px 24px' }}>
          <div style={{ fontSize: 12, color: 'var(--ye)', fontWeight: 700, marginBottom: 8 }}>
            ⚠ {unassignedLeads.length} lead{unassignedLeads.length > 1 ? 's' : ''} uden fase — vælg en fase for at få dem tilbage på boardet
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {unassignedLeads.map(l => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 7, padding: '5px 8px' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{l.company_name}</span>
                <select value="" onChange={e => e.target.value && void assignStage(l.id, Number(e.target.value))}
                  style={{ fontSize: 11, padding: '3px 6px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 5, color: 'var(--t1)' }}>
                  <option value="" disabled>Vælg fase…</option>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kanban board */}
      <div style={{ flex: 1, overflowX: 'auto', padding: '16px 24px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => void handleDragEnd(e)}>
          {activeStages.map(stage => (
            <StageColumn key={stage.id} stage={stage}
              leads={leads.filter(l => l.stage_id === stage.id)}
              onCardClick={setSelectedLead}
            />
          ))}
          {wonLostStages.length > 0 && <div style={{ width: 1, background: 'var(--bd)', alignSelf: 'stretch', flexShrink: 0 }} />}
          {wonLostStages.map(stage => (
            <StageColumn key={stage.id} stage={stage}
              leads={leads.filter(l => l.stage_id === stage.id)}
              onCardClick={setSelectedLead}
              collapsed={collapsedCols.has(stage.id)}
              onToggle={() => toggleCollapse(stage.id)}
            />
          ))}
        </DndContext>
      </div>

      {selectedLead !== null && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setSelectedLead(null)} />
          <LeadPanel leadId={selectedLead} stages={stages} onClose={() => setSelectedLead(null)} onUpdate={() => { void loadLeads(); void loadOverview(); }} />
        </>
      )}

      {showNewLead && <NewLeadModal stages={stages} onClose={() => setShowNewLead(false)} onCreated={() => { void loadLeads(); void loadOverview(); }} />}

      {showEditor && <StageEditorModal stages={stages} onClose={() => setShowEditor(false)} onSaved={() => { void loadStages(); void loadLeads(); }} />}
    </div>
  );
}
