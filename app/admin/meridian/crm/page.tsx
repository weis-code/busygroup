'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { flag } from '@/lib/countries';
import type { Stage, Lead } from './_components/types';
import { fmt, fmtDate, isOverdue, daysInStage, MERIDIAN_PRODUCTS, INDUSTRIES } from './_components/types';
import LeadPanel from './_components/LeadPanel';

/* ── Sortable lead card ──────────────────────────────── */
function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });
  const overdue = isOverdue(lead.next_action_date);
  const soonDue = !overdue && lead.next_action_date && lead.next_action_date <= new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      {...attributes} {...listeners}>
      <div onClick={onClick} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 8, padding: '10px 12px', marginBottom: 6, cursor: 'pointer', transition: 'border-color 0.1s' }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--bd2)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--bd)')}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>{lead.company_name}</div>
        {lead.contact_name && <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 5 }}>{lead.contact_name}{lead.contact_title ? ` · ${lead.contact_title}` : ''}</div>}
        {(lead.products as string[] ?? []).length > 0 && (
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 5 }}>
            {(lead.products as string[]).map((p: string) => (
              <span key={p} style={{ fontSize: 9, padding: '2px 5px', background: 'var(--bl2)', borderRadius: 100, color: 'var(--bl)', fontWeight: 600 }}>{p}</span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {lead.deal_value_dkk > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gr)' }}>{fmt(lead.deal_value_dkk)}/md.</span>}
          {lead.country !== 'DK' && <span style={{ fontSize: 11 }}>{flag(lead.country)}</span>}
          <span style={{ fontSize: 9, color: 'var(--t3)', marginLeft: 'auto' }}>{daysInStage(lead.updated_at)} dage</span>
          {Number(lead.activity_count) > 0 && <span style={{ fontSize: 9, color: 'var(--t3)' }}>💬 {lead.activity_count}</span>}
        </div>
        {lead.next_action_label && (
          <div style={{ marginTop: 5, fontSize: 10, color: overdue ? 'var(--re)' : soonDue ? 'var(--ye)' : 'var(--t3)', fontWeight: overdue || soonDue ? 600 : 400 }}>
            📅 {lead.next_action_label}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Stage column ────────────────────────────────────── */
function StageColumn({ stage, leads, onCardClick }: {
  stage: Stage; leads: Lead[]; onCardClick: (id: number) => void;
}) {
  const ids = leads.map(l => l.id);
  return (
    <div style={{ width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, padding: '0 2px' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: stage.color, display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stage.name}</span>
        <span style={{ fontSize: 10, color: 'var(--t3)', background: 'var(--s2)', border: '1px solid var(--bd)', padding: '1px 6px', borderRadius: 100, flexShrink: 0 }}>{leads.length}</span>
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div data-stage-id={stage.id} style={{ flex: 1, minHeight: 60 }}>
          {leads.map(l => <LeadCard key={l.id} lead={l} onClick={() => onCardClick(l.id)} />)}
        </div>
      </SortableContext>
      {stage.is_won && leads.length > 0 && (
        <div style={{ fontSize: 10, color: 'var(--gr)', fontWeight: 600, textAlign: 'center', marginTop: 4 }}>
          {fmt(leads.reduce((s, l) => s + l.deal_value_dkk, 0))}/md.
        </div>
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
            <select value={form.stage_id} onChange={e => { const st = stages.find(s => s.id === Number(e.target.value)); setForm(f => ({ ...f, stage_id: Number(e.target.value), probability: st?.probability ?? 0 })); }}>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
      <style>{`
        .mcrm-field input, .mcrm-field select { width:100%; padding:7px 9px; background:var(--s2); border:1px solid var(--bd); border-radius:6px; color:var(--t1); font-size:12px; box-sizing:border-box; }
      `}</style>
      <div className="mcrm-field">{children}</div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────── */
export default function MeridianCrmPage() {
  const [stages, setStages]       = useState<Stage[]>([]);
  const [leads, setLeads]         = useState<Lead[]>([]);
  const [overview, setOverview]   = useState<{ pipelineValue: number; weightedPipeline: number; wonThisMonth: { count: number; value: number }; activitiesThisWeek: number; leadsByStage: Array<{ id: number; name: string; lead_count: number; total_value: number }> } | null>(null);
  const [search, setSearch]       = useState('');
  const [selectedLead, setSelectedLead] = useState<number | null>(null);
  const [showNewLead, setShowNewLead]   = useState(false);
  const [statsOpen, setStatsOpen]       = useState(true);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const loadStages = useCallback(async () => {
    const data = await fetch('/api/meridian/crm/stages').then(r => r.json()) as Stage[];
    setStages(Array.isArray(data) ? data : []);
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

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const leadId = Number(active.id);
    const overId = Number(over.id);
    // over.id is either another lead id or a stage id — find target stage
    const targetLead  = leads.find(l => l.id === overId);
    const targetStageId = targetLead ? targetLead.stage_id : null;
    const targetStage = targetStageId ? stages.find(s => s.id === targetStageId) : null;
    if (!targetStage) return;
    const sourceLead = leads.find(l => l.id === leadId);
    if (sourceLead?.stage_id === targetStage.id) return;
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage_id: targetStage.id, stage_name: targetStage.name, stage_color: targetStage.color } : l));
    await fetch(`/api/meridian/crm/leads/${leadId}/stage`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage_id: targetStage.id }),
    }).catch(() => void loadLeads());
    void loadOverview();
  }

  const activeStages  = stages.filter(s => !s.is_won && !s.is_lost);
  const wonStage      = stages.find(s => s.is_won);
  const lostStage     = stages.find(s => s.is_lost);
  const filteredLeads = search ? leads : leads;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ flexShrink: 0, background: 'var(--s1)', borderBottom: '1px solid var(--bd)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>Min Pipeline</div>
        {overview && <div style={{ fontSize: 12, color: 'var(--t3)' }}>Vægtet: <strong style={{ color: 'var(--bl)' }}>{fmt(overview.weightedPipeline)}</strong></div>}
        <div style={{ flex: 1 }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Søg firma eller kontakt…"
          style={{ fontSize: 12, padding: '6px 10px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 7, color: 'var(--t1)', width: 200 }} />
        <button onClick={() => setShowNewLead(true)}
          style={{ background: 'var(--bl)', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Nyt lead
        </button>
      </div>

      {/* Stats strip */}
      {statsOpen && overview && (
        <div style={{ flexShrink: 0, background: 'var(--s1)', borderBottom: '1px solid var(--bd)', padding: '12px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 10 }}>
            {[
              { label: 'Pipeline værdi',    value: fmt(overview.pipelineValue), color: 'var(--t1)' },
              { label: 'Vægtet pipeline',   value: fmt(overview.weightedPipeline), color: 'var(--bl)' },
              { label: 'Vundet denne md.',  value: `${overview.wonThisMonth.count} · ${fmt(overview.wonThisMonth.value)}`, color: 'var(--gr)' },
              { label: 'Aktiviteter i uge', value: String(overview.activitiesThisWeek), color: 'var(--pu)' },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{k.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {overview.leadsByStage.filter(s => s.lead_count > 0).map(s => (
              <div key={s.id} style={{ fontSize: 10, padding: '3px 8px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 6, color: 'var(--t2)' }}>
                {s.name}: {s.lead_count} · {fmt(s.total_value)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kanban board */}
      <div style={{ flex: 1, overflowX: 'auto', padding: '16px 24px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => void handleDragEnd(e)}>
          {activeStages.map(stage => {
            const stageLeads = filteredLeads.filter(l => l.stage_id === stage.id);
            return <StageColumn key={stage.id} stage={stage} leads={stageLeads} onCardClick={setSelectedLead} />;
          })}

          {/* Won / Lost columns */}
          {wonStage && (
            <StageColumn key={wonStage.id} stage={wonStage} leads={filteredLeads.filter(l => l.stage_id === wonStage.id)} onCardClick={setSelectedLead} />
          )}
          {lostStage && (
            <StageColumn key={lostStage.id} stage={lostStage} leads={filteredLeads.filter(l => l.stage_id === lostStage.id)} onCardClick={setSelectedLead} />
          )}
        </DndContext>
      </div>

      {/* Lead detail panel */}
      {selectedLead !== null && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setSelectedLead(null)} />
          <LeadPanel leadId={selectedLead} stages={stages} onClose={() => setSelectedLead(null)} onUpdate={() => { void loadLeads(); void loadOverview(); }} />
        </>
      )}

      {/* New lead modal */}
      {showNewLead && <NewLeadModal stages={stages} onClose={() => setShowNewLead(false)} onCreated={() => { void loadLeads(); void loadOverview(); }} />}
    </div>
  );
}
