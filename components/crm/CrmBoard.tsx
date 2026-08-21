'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { flag, PRIORITY_COUNTRIES, ALL_COUNTRIES } from '@/lib/countries';

/* ── Types ─────────────────────────────────────────── */
interface Stage {
  id: number; key: string; label: string; color: string;
  probability: number; position: number; is_won: boolean; is_lost: boolean;
}
interface DealProduct { id: number; name: string; price: number | null; type: string | null }
interface NextActionEntry { id: number; type: string; next_action: string; next_action_date: string }
interface Deal {
  id: number; title: string; value: number | null; stage: string; status: string;
  product: string | null; country: string | null; company_id: number | null;
  portfolio_company_name: string | null;
  workspace_name: string | null;
  prospect_name: string | null; prospect_company: string | null;
  prospect_phone: string | null; prospect_email: string | null;
  owner_name: string; touchpoint_count: number;
  next_action_entry: NextActionEntry | null;
  products: DealProduct[] | null;
  won_at: string | null; lost_at: string | null; lost_reason: string | null;
}
interface Touchpoint {
  id: number; type: string; direction: string | null; title: string; body: string | null;
  outcome: string | null; duration_minutes: number | null;
  next_action: string | null; next_action_date: string | null; next_action_done: boolean;
  extra: Record<string, unknown>; owner_name: string; created_at: string;
}
interface PortfolioCompany { id: number; name: string }
interface CrmProduct { id: number; name: string; price: number | null; type: string }

/* ── Constants ─────────────────────────────────────── */
const TYPE_META: Record<string, { icon: string; label: string }> = {
  call:      { icon: '📞', label: 'Opkald' },
  email:     { icon: '📧', label: 'Email' },
  meeting:   { icon: '🤝', label: 'Møde' },
  demo:      { icon: '💻', label: 'Demo' },
  proposal:  { icon: '📄', label: 'Tilbud' },
  follow_up: { icon: '🔔', label: 'Opfølgning' },
  linkedin:  { icon: '🔗', label: 'LinkedIn' },
  note:      { icon: '📝', label: 'Note' },
};

const CALL_OUTCOMES     = ['Svarede', 'Svarede ikke', 'Voicemail', 'Forkert nummer', 'Ringet tilbage'];
const EMAIL_OUTCOMES    = ['Sendt', 'Åbnet', 'Svar modtaget', 'Intet svar'];
const MEETING_OUTCOMES  = ['Positivt', 'Neutralt', 'Negativt'];
const DEMO_OUTCOMES     = ['Meget interesseret', 'Interesseret', 'Neutral', 'Ikke interesseret'];
const FOLLOWUP_OUTCOMES = ['Svar modtaget', 'Intet svar', 'Positiv', 'Negativ'];
const LINKEDIN_OUTCOMES = ['Accepteret', 'Intet svar', 'Svar modtaget'];

const STAGE_COLORS = [
  'var(--bl)', 'var(--gr)', 'var(--pu)', 'var(--ye)',
  'var(--or)', 'var(--re)', 'var(--t2)', '#06b6d4',
];

/* ── Helpers ───────────────────────────────────────── */
const fmt = (n: number) => Number(n).toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' kr';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Lige nu';
  if (m < 60) return `${m} min siden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} t siden`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d siden`;
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

function fmtDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return dateStr < new Date().toISOString().slice(0, 10);
}

function groupByDate(touchpoints: Touchpoint[]): { label: string; items: Touchpoint[] }[] {
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const weekAgo   = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const groups    = new Map<string, Touchpoint[]>();
  for (const t of touchpoints) {
    const d = t.created_at.slice(0, 10);
    let key: string;
    if (d === today)          key = 'I dag';
    else if (d === yesterday) key = 'I går';
    else if (d >= weekAgo)    key = 'Denne uge';
    else key = new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

/* ── Toast ─────────────────────────────────────────── */
function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, [onDone]);
  return <div className="toast-container"><div className="toast">{msg}</div></div>;
}

/* ── Country Picker ─────────────────────────────────── */
function CountryPicker({ value, onChange, style }: {
  value: string; onChange: (code: string) => void; style?: React.CSSProperties;
}) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const filtered = query.trim()
    ? ALL_COUNTRIES.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || c.code.toLowerCase().includes(query.toLowerCase()))
    : ALL_COUNTRIES;

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '7px 10px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 7, fontSize: 12, color: 'var(--t1)', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
        {value ? <>{flag(value)} {ALL_COUNTRIES.find(c => c.code === value)?.name ?? value}</> : 'Vælg land…'}
        <span style={{ marginLeft: 'auto', opacity: 0.4, fontSize: 10 }}>▼</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 900, background: 'var(--s1)', border: '1px solid var(--bd2)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', marginTop: 4, overflow: 'hidden' }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--bd)' }}>
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Søg land…" style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '5px 8px', fontSize: 12 }} />
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {!query.trim() && (
              <>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', padding: '6px 10px 2px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Mest brugte</div>
                {PRIORITY_COUNTRIES.map(c => (
                  <button key={c.code} type="button" onClick={() => { onChange(c.code); setOpen(false); setQuery(''); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', background: value === c.code ? 'var(--bl2)' : 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--t1)', textAlign: 'left' }}>
                    <span>{flag(c.code)}</span> {c.name}
                  </button>
                ))}
                <div style={{ height: 1, background: 'var(--bd)', margin: '4px 0' }} />
              </>
            )}
            {filtered.filter(c => query.trim() || !PRIORITY_COUNTRIES.find(p => p.code === c.code)).map(c => (
              <button key={c.code} type="button" onClick={() => { onChange(c.code); setOpen(false); setQuery(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', background: value === c.code ? 'var(--bl2)' : 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--t1)', textAlign: 'left' }}>
                <span>{flag(c.code)}</span> {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Product Selector ─────────────────────────────── */
function ProductSelector({ dealId, products, ownProducts, onRefresh }: {
  dealId: number; products: DealProduct[]; ownProducts: CrmProduct[]; onRefresh: () => void;
}) {
  const [open, setOpen]     = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customType, setCustomType] = useState('monthly');
  const [adding, setAdding] = useState(false);

  const totalMrr = products.filter(p => p.type === 'monthly').reduce((s, p) => s + Number(p.price ?? 0), 0);
  const totalOt  = products.filter(p => p.type !== 'monthly').reduce((s, p) => s + Number(p.price ?? 0), 0);

  async function addProduct(productId: number) {
    await fetch(`/api/crm/deals/${dealId}/products`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId }),
    });
    onRefresh();
  }

  async function removeProduct(dpId: number) {
    await fetch(`/api/crm/deals/${dealId}/products/${dpId}`, { method: 'DELETE' });
    onRefresh();
  }

  async function addCustom() {
    if (!customName.trim()) return;
    setAdding(true);
    await fetch(`/api/crm/deals/${dealId}/products`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: customName, price: customPrice ? Number(customPrice) : null, type: customType }),
    });
    setCustomName(''); setCustomPrice(''); setAdding(false);
    onRefresh();
  }

  const linkedIds = new Set(products.map(p => p.name));

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Produkter</span>
        <button type="button" onClick={() => setOpen(o => !o)} style={{ fontSize: 11, color: 'var(--bl)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>+ Tilføj</button>
      </div>

      {products.length === 0 && !open && (
        <div style={{ fontSize: 11, color: 'var(--t4)', padding: '6px 0' }}>Ingen produkter</div>
      )}

      {products.map(p => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 11, flex: 1, color: 'var(--t1)' }}>{p.name}</span>
          {p.price != null && <span style={{ fontSize: 11, color: 'var(--gr)', fontWeight: 600 }}>{fmt(Number(p.price))}{p.type === 'monthly' ? '/md.' : ''}</span>}
          <button type="button" onClick={() => removeProduct(p.id)} style={{ fontSize: 11, color: 'var(--re)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}>✕</button>
        </div>
      ))}

      {(totalMrr > 0 || totalOt > 0) && (
        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--bd)' }}>
          {totalMrr > 0 && <span style={{ marginRight: 10 }}>MRR: <strong style={{ color: 'var(--gr)' }}>{fmt(totalMrr)}/md.</strong></span>}
          {totalOt > 0 && <span>Engangs: <strong style={{ color: 'var(--bl)' }}>{fmt(totalOt)}</strong></span>}
        </div>
      )}

      {open && (
        <div style={{ marginTop: 8, background: 'var(--s3)', borderRadius: 8, padding: '10px 12px' }}>
          {ownProducts.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>
              Ingen produkter endnu. <a href="/admin/crm/products" style={{ color: 'var(--bl)' }}>Opret dit første produkt →</a>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Dine produkter</div>
              {ownProducts.map(p => {
                const already = linkedIds.has(p.name);
                return (
                  <button key={p.id} type="button" disabled={already} onClick={() => !already && addProduct(p.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 0', background: 'none', border: 'none', cursor: already ? 'default' : 'pointer', opacity: already ? 0.4 : 1, textAlign: 'left' }}>
                    <span style={{ fontSize: 11, flex: 1, color: 'var(--t1)' }}>{p.name}</span>
                    {p.price != null && <span style={{ fontSize: 11, color: 'var(--gr)' }}>{fmt(Number(p.price))}{p.type === 'monthly' ? '/md.' : ''}</span>}
                    {!already && <span style={{ fontSize: 11, color: 'var(--bl)' }}>+</span>}
                  </button>
                );
              })}
            </>
          )}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--bd)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Andet produkt</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6 }}>
              <input placeholder="Produktnavn" value={customName} onChange={e => setCustomName(e.target.value)} style={{ fontSize: 12 }} />
              <input type="number" placeholder="Pris" value={customPrice} onChange={e => setCustomPrice(e.target.value)} style={{ width: 80, fontSize: 12 }} />
              <select value={customType} onChange={e => setCustomType(e.target.value)} style={{ fontSize: 12, width: 'auto' }}>
                <option value="monthly">Md.</option>
                <option value="one_time">Engangs</option>
              </select>
            </div>
            <button type="button" onClick={addCustom} disabled={adding || !customName.trim()} style={{ marginTop: 8, fontSize: 11, color: 'var(--bl)', background: 'var(--bl2)', border: '1px solid rgba(79,142,247,0.3)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', width: '100%' }}>
              {adding ? 'Tilføjer…' : '+ Tilføj'}
            </button>
          </div>
          <button type="button" onClick={() => setOpen(false)} style={{ marginTop: 8, fontSize: 10, color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'center' }}>Luk</button>
        </div>
      )}
    </div>
  );
}

/* ── Stage Editor ─────────────────────────────────── */
function SortableStageRow({ stage, onRename, onColorChange, onProbabilityChange, onDelete, allStages }: {
  stage: Stage; onRename: (id: number, label: string) => void;
  onColorChange: (id: number, color: string) => void;
  onProbabilityChange: (id: number, prob: number) => void;
  onDelete: (id: number, moveToStageId?: number) => void;
  allStages: Stage[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: stage.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [editLabel, setEditLabel]   = useState(stage.label);
  const [editProb, setEditProb]     = useState(String(stage.probability));
  const [showColors, setShowColors] = useState(false);
  const [showDeleteConf, setShowDeleteConf] = useState(false);
  const [moveToId, setMoveToId]     = useState('');

  const fixed = stage.is_won || stage.is_lost;

  return (
    <div ref={setNodeRef} style={{ ...style, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--bd)' }}>
      {/* Drag handle */}
      {!fixed && (
        <span {...attributes} {...listeners} style={{ cursor: 'grab', color: 'var(--t4)', fontSize: 14, padding: '0 4px', touchAction: 'none' }}>⋮⋮</span>
      )}
      {fixed && <span style={{ width: 22 }} />}

      {/* Color dot */}
      <div style={{ position: 'relative' }}>
        <button type="button" onClick={() => !fixed && setShowColors(s => !s)}
          style={{ width: 14, height: 14, borderRadius: '50%', background: stage.color, border: '2px solid rgba(255,255,255,0.2)', cursor: fixed ? 'default' : 'pointer', flexShrink: 0 }} />
        {showColors && (
          <div style={{ position: 'absolute', top: 20, left: 0, zIndex: 50, background: 'var(--s1)', border: '1px solid var(--bd2)', borderRadius: 8, padding: 8, display: 'flex', gap: 6, flexWrap: 'wrap', width: 130, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
            {STAGE_COLORS.map(c => (
              <button key={c} type="button" onClick={() => { onColorChange(stage.id, c); setShowColors(false); }}
                style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: stage.color === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }} />
            ))}
          </div>
        )}
      </div>

      {/* Label */}
      <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
        onBlur={() => { if (editLabel.trim() && editLabel !== stage.label) onRename(stage.id, editLabel.trim()); }}
        style={{ flex: 1, fontSize: 12, background: 'transparent', border: 'none', borderBottom: '1px solid var(--bd)', padding: '2px 4px', color: fixed ? 'var(--t3)' : 'var(--t1)', fontStyle: fixed ? 'italic' : 'normal' }}
        readOnly={fixed} />

      {/* Probability */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input type="number" min={0} max={100} value={editProb} onChange={e => setEditProb(e.target.value)}
          onBlur={() => { const n = Number(editProb); if (!isNaN(n)) onProbabilityChange(stage.id, n); }}
          style={{ width: 50, fontSize: 11, textAlign: 'right', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 5, padding: '2px 6px' }} />
        <span style={{ fontSize: 10, color: 'var(--t3)' }}>%</span>
      </div>

      {/* Delete */}
      {!fixed && !showDeleteConf && (
        <button type="button" onClick={() => setShowDeleteConf(true)} style={{ fontSize: 11, color: 'var(--re)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, padding: '0 4px' }}>Slet</button>
      )}
      {!fixed && showDeleteConf && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11 }}>
          <select value={moveToId} onChange={e => setMoveToId(e.target.value)} style={{ fontSize: 11, padding: '2px 4px', width: 'auto' }}>
            <option value="">Flyt deals til…</option>
            {allStages.filter(s => s.id !== stage.id).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button type="button" onClick={() => onDelete(stage.id, moveToId ? Number(moveToId) : undefined)} style={{ color: 'var(--re)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}>✓</button>
          <button type="button" onClick={() => setShowDeleteConf(false)} style={{ color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}>✕</button>
        </div>
      )}
      {fixed && <span style={{ width: 40 }} />}
    </div>
  );
}

function StageEditorModal({ stages: initStages, onClose, onSaved }: {
  stages: Stage[]; onClose: () => void; onSaved: () => void;
}) {
  const [stages, setStages] = useState(initStages);
  const [newLabel, setNewLabel]   = useState('');
  const [newColor, setNewColor]   = useState('var(--bl)');
  const [saving, setSaving]       = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const normalStages = stages.filter(s => !s.is_won && !s.is_lost);
  const fixedStages  = stages.filter(s => s.is_won || s.is_lost);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = normalStages.findIndex(s => s.id === active.id);
    const newIdx = normalStages.findIndex(s => s.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(normalStages, oldIdx, newIdx);
    setStages([...reordered, ...fixedStages]);
  }

  async function saveName(id: number, label: string) {
    await fetch(`/api/crm/stages/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label }) });
    setStages(ss => ss.map(s => s.id === id ? { ...s, label } : s));
  }

  async function saveColor(id: number, color: string) {
    await fetch(`/api/crm/stages/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ color }) });
    setStages(ss => ss.map(s => s.id === id ? { ...s, color } : s));
  }

  async function saveProb(id: number, probability: number) {
    await fetch(`/api/crm/stages/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ probability }) });
    setStages(ss => ss.map(s => s.id === id ? { ...s, probability } : s));
  }

  async function deleteStage(id: number, moveToStageId?: number) {
    await fetch(`/api/crm/stages/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(moveToStageId ? { move_deals_to_stage_id: moveToStageId } : {}),
    });
    setStages(ss => ss.filter(s => s.id !== id));
  }

  async function addStage() {
    if (!newLabel.trim()) return;
    const res = await fetch('/api/crm/stages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: newLabel.trim(), color: newColor, probability: 50 }) });
    const stage = await res.json() as Stage;
    setStages(ss => {
      const normal = ss.filter(s => !s.is_won && !s.is_lost);
      const fixed  = ss.filter(s => s.is_won || s.is_lost);
      return [...normal, stage, ...fixed];
    });
    setNewLabel('');
  }

  async function saveOrder() {
    setSaving(true);
    const order = [...normalStages, ...fixedStages].map(s => s.id);
    await fetch('/api/crm/stages/reorder', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order }) });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--s1)', borderRadius: 13, padding: 24, width: 520, maxWidth: '94vw', boxShadow: '0 40px 80px rgba(0,0,0,0.7)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Rediger pipeline</div>
        <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 16 }}>Træk for at omarrangere. Vundet og Tabt er altid sidst.</div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={normalStages.map(s => s.id)} strategy={verticalListSortingStrategy}>
            {normalStages.map(s => (
              <SortableStageRow key={s.id} stage={s} allStages={stages}
                onRename={saveName} onColorChange={saveColor} onProbabilityChange={saveProb} onDelete={deleteStage} />
            ))}
          </SortableContext>
        </DndContext>

        {fixedStages.map(s => (
          <SortableStageRow key={s.id} stage={s} allStages={stages}
            onRename={saveName} onColorChange={saveColor} onProbabilityChange={saveProb} onDelete={deleteStage} />
        ))}

        {/* Add new stage */}
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Nyt stadie navn…" style={{ flex: 1, fontSize: 12 }} onKeyDown={e => e.key === 'Enter' && addStage()} />
          <div style={{ display: 'flex', gap: 4 }}>
            {STAGE_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setNewColor(c)}
                style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: newColor === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }} />
            ))}
          </div>
          <button type="button" onClick={addStage} style={{ padding: '6px 12px', background: 'var(--bl)', color: '#fff', borderRadius: 7, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>+ Tilføj</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 14px', background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, fontSize: 12 }}>Annuller</button>
          <button type="button" onClick={saveOrder} disabled={saving} style={{ padding: '8px 16px', background: 'var(--bl)', color: '#fff', borderRadius: 7, fontSize: 12, fontWeight: 700 }}>
            {saving ? 'Gemmer…' : 'Gem rækkefølge'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Log Activity Form ─────────────────────────────── */
function LogActivityForm({ dealId, dealValue, onSaved }: { dealId: number; dealValue: number | null; onSaved: () => void }) {
  const [open, setOpen]     = useState(false);
  const [type, setType]     = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm]     = useState({
    direction: '', outcome: '', body: '', duration_minutes: '',
    next_action: '', next_action_date: '',
    extra_meeting_format: '', extra_participants: '',
    extra_demo_platform: '', extra_proposal_amount: '', extra_proposal_via: '', extra_proposal_expiry: '',
    extra_followup_channel: '', extra_linkedin_action: '',
  });

  function set(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }

  // Auto-fill proposal amount from deal value
  useEffect(() => {
    if (type === 'proposal' && dealValue && !form.extra_proposal_amount) {
      set('extra_proposal_amount', String(dealValue));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  async function submit() {
    if (!type) return;
    setSaving(true);
    const extra: Record<string, string> = {};
    if (form.extra_meeting_format)   extra.meeting_format   = form.extra_meeting_format;
    if (form.extra_participants)     extra.participants     = form.extra_participants;
    if (form.extra_demo_platform)    extra.demo_platform    = form.extra_demo_platform;
    if (form.extra_proposal_amount)  extra.proposal_amount  = form.extra_proposal_amount;
    if (form.extra_proposal_via)     extra.proposal_via     = form.extra_proposal_via;
    if (form.extra_proposal_expiry)  extra.proposal_expiry  = form.extra_proposal_expiry;
    if (form.extra_followup_channel) extra.followup_channel = form.extra_followup_channel;
    if (form.extra_linkedin_action)  extra.linkedin_action  = form.extra_linkedin_action;

    await fetch('/api/crm/touchpoints', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deal_id: dealId, type,
        direction: form.direction || null, body: form.body || null,
        outcome: form.outcome || null,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
        next_action: form.next_action || null, next_action_date: form.next_action_date || null,
        extra,
      }),
    });

    setSaving(false);
    setOpen(false);
    setType('');
    setForm({ direction: '', outcome: '', body: '', duration_minutes: '', next_action: '', next_action_date: '', extra_meeting_format: '', extra_participants: '', extra_demo_platform: '', extra_proposal_amount: '', extra_proposal_via: '', extra_proposal_expiry: '', extra_followup_channel: '', extra_linkedin_action: '' });
    onSaved();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ width: '100%', padding: '10px 0', borderRadius: 8, background: 'var(--bl2)', border: '1px dashed rgba(79,142,247,0.4)', color: 'var(--bl)', fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
        + Log aktivitet
      </button>
    );
  }

  return (
    <div style={{ background: 'var(--s2)', border: '1px solid var(--bd2)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {Object.entries(TYPE_META).map(([k, v]) => (
          <button key={k} onClick={() => setType(k)} title={v.label} style={{ fontSize: 18, padding: '6px 10px', borderRadius: 7, background: type === k ? 'var(--bl2)' : 'var(--s3)', border: type === k ? '1px solid var(--bl)' : '1px solid var(--bd)', cursor: 'pointer' }}>
            {v.icon}
          </button>
        ))}
      </div>

      {type && (
        <>
          {type === 'call' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div><label>Udfald</label>
                <select value={form.outcome} onChange={e => set('outcome', e.target.value)}>
                  <option value="">Vælg…</option>
                  {CALL_OUTCOMES.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div><label>Varighed (min)</label><input type="number" placeholder="4" value={form.duration_minutes} onChange={e => set('duration_minutes', e.target.value)} /></div>
            </div>
          )}

          {type === 'email' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div><label>Retning</label>
                <select value={form.direction} onChange={e => set('direction', e.target.value)}>
                  <option value="">Vælg…</option>
                  <option value="outbound">Udgående</option>
                  <option value="inbound">Indgående</option>
                </select>
              </div>
              <div><label>Udfald</label>
                <select value={form.outcome} onChange={e => set('outcome', e.target.value)}>
                  <option value="">Vælg…</option>
                  {EMAIL_OUTCOMES.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          )}

          {type === 'meeting' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div><label>Mødeform</label>
                <select value={form.extra_meeting_format} onChange={e => set('extra_meeting_format', e.target.value)}>
                  <option value="">Vælg…</option>
                  <option>Fysisk</option><option>Video</option><option>Telefon</option>
                </select>
              </div>
              <div><label>Udfald</label>
                <select value={form.outcome} onChange={e => set('outcome', e.target.value)}>
                  <option value="">Vælg…</option>
                  {MEETING_OUTCOMES.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          )}

          {type === 'demo' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div><label>Platform</label>
                <select value={form.extra_demo_platform} onChange={e => set('extra_demo_platform', e.target.value)}>
                  <option value="">Vælg…</option>
                  <option>Teams</option><option>Zoom</option><option>Fysisk</option><option>Andet</option>
                </select>
              </div>
              <div><label>Udfald</label>
                <select value={form.outcome} onChange={e => set('outcome', e.target.value)}>
                  <option value="">Vælg…</option>
                  {DEMO_OUTCOMES.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          )}

          {type === 'proposal' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div><label>Beløb (DKK)</label><input type="number" value={form.extra_proposal_amount} onChange={e => set('extra_proposal_amount', e.target.value)} /></div>
              <div><label>Sendt via</label>
                <select value={form.extra_proposal_via} onChange={e => set('extra_proposal_via', e.target.value)}>
                  <option value="">Vælg…</option>
                  <option>Email</option><option>Fysisk</option><option>Andet</option>
                </select>
              </div>
              <div><label>Udløbsdato</label><input type="date" value={form.extra_proposal_expiry} onChange={e => set('extra_proposal_expiry', e.target.value)} /></div>
            </div>
          )}

          {type === 'follow_up' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div><label>Kanal</label>
                <select value={form.extra_followup_channel} onChange={e => set('extra_followup_channel', e.target.value)}>
                  <option value="">Vælg…</option>
                  <option>Email</option><option>Opkald</option><option>LinkedIn</option><option>SMS</option>
                </select>
              </div>
              <div><label>Udfald</label>
                <select value={form.outcome} onChange={e => set('outcome', e.target.value)}>
                  <option value="">Vælg…</option>
                  {FOLLOWUP_OUTCOMES.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          )}

          {type === 'linkedin' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div><label>Handling</label>
                <select value={form.extra_linkedin_action} onChange={e => set('extra_linkedin_action', e.target.value)}>
                  <option value="">Vælg…</option>
                  <option>Forbindelsesanmodning</option><option>Besked</option><option>Inmail</option>
                </select>
              </div>
              <div><label>Udfald</label>
                <select value={form.outcome} onChange={e => set('outcome', e.target.value)}>
                  <option value="">Vælg…</option>
                  {LINKEDIN_OUTCOMES.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <label>{type === 'note' ? 'Note *' : 'Resume / noter'}</label>
            <textarea rows={3} placeholder={type === 'note' ? 'Skriv hvad du vil huske…' : 'Hvad skete der?'} value={form.body} onChange={e => set('body', e.target.value)} />
          </div>

          {type !== 'note' && (
            <div style={{ background: 'var(--s3)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 8 }}>Næste handling</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input placeholder="Ring igen, send tilbud…" value={form.next_action} onChange={e => set('next_action', e.target.value)} />
                <input type="date" value={form.next_action_date} onChange={e => set('next_action_date', e.target.value)} style={{ width: 140 }} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setOpen(false); setType(''); }} style={{ flex: 1, padding: '8px 0', borderRadius: 7, background: 'var(--s3)', color: 'var(--t3)', border: '1px solid var(--bd)', fontSize: 12 }}>Annuller</button>
            <button onClick={submit} disabled={!type || saving || (type === 'note' && !form.body.trim())} style={{ flex: 2, padding: '8px 0', borderRadius: 7, background: 'var(--bl)', color: '#fff', fontSize: 12, fontWeight: 700 }}>
              {saving ? 'Gemmer…' : 'Log aktivitet'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Touchpoint Entry ───────────────────────────────── */
function TouchpointEntry({ t, onRefresh }: { t: Touchpoint; onRefresh: () => void }) {
  const meta    = TYPE_META[t.type] ?? { icon: '•', label: t.type };
  const overdue = t.next_action && !t.next_action_done && isOverdue(t.next_action_date);
  const [hovered, setHovered] = useState(false);

  async function markDone() {
    await fetch(`/api/crm/touchpoints/${t.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ next_action_done: true }) });
    onRefresh();
  }
  async function del() {
    if (!confirm('Slet denne aktivitet?')) return;
    await fetch(`/api/crm/touchpoints/${t.id}`, { method: 'DELETE' });
    onRefresh();
  }

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ display: 'flex', gap: 10, padding: '12px 0', borderBottom: '1px solid var(--bd)' }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--s3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, marginTop: 2 }}>
        {meta.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{t.title}</div>
          <div style={{ fontSize: 10, color: 'var(--t3)', flexShrink: 0 }}>{timeAgo(t.created_at)}</div>
        </div>
        {t.body && <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 3, lineHeight: 1.5 }}>{t.body}</div>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
          {t.outcome && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 100, background: 'var(--s3)', color: 'var(--t2)', fontWeight: 600 }}>{t.outcome}</span>}
          {t.duration_minutes && <span style={{ fontSize: 10, color: 'var(--t3)', padding: '2px 7px', borderRadius: 100, background: 'var(--s3)' }}>{t.duration_minutes} min</span>}
        </div>
        {t.next_action && !t.next_action_done && (
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: overdue ? 'var(--re)' : 'var(--or)', background: overdue ? 'var(--re2)' : 'var(--or2)', padding: '2px 8px', borderRadius: 100, fontWeight: 600 }}>
              {overdue ? '⚠ ' : ''}Næste: {t.next_action}{t.next_action_date ? ` · ${fmtDate(t.next_action_date)}` : ''}
            </span>
            <button onClick={markDone} style={{ fontSize: 10, color: 'var(--gr)', background: 'var(--gr2)', border: 'none', borderRadius: 100, padding: '2px 8px', fontWeight: 600, cursor: 'pointer' }}>✓ Udført</button>
          </div>
        )}
        {t.next_action && t.next_action_done && (
          <div style={{ marginTop: 5, fontSize: 10, color: 'var(--t3)', textDecoration: 'line-through' }}>{t.next_action}</div>
        )}
        {hovered && (
          <button onClick={del} style={{ fontSize: 10, color: 'var(--re)', background: 'none', border: 'none', padding: '4px 0 0', cursor: 'pointer', opacity: 0.7 }}>Slet</button>
        )}
      </div>
    </div>
  );
}

/* ── Deal Panel ─────────────────────────────────────── */
function DealPanel({ deal, stages, ownProducts, portfolioCompanies, onClose, onStageChange, onUpdated, onDeleted }: {
  deal: Deal; stages: Stage[]; ownProducts: CrmProduct[]; portfolioCompanies: PortfolioCompany[];
  onClose: () => void; onStageChange: (stage: string) => void; onUpdated: () => void; onDeleted: () => void;
}) {
  const [touchpoints, setTouchpoints] = useState<Touchpoint[]>([]);
  const [products, setProducts]       = useState<DealProduct[]>(Array.isArray(deal.products) ? deal.products : []);
  const [loading, setLoading]         = useState(true);
  const [lostReason, setLostReason]   = useState('');
  const [showLostPrompt, setShowLostPrompt] = useState(false);
  const [editing, setEditing]         = useState(false);
  const [editSaving, setEditSaving]   = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [editForm, setEditForm]       = useState({
    title: deal.title, prospect_name: deal.prospect_name ?? '',
    prospect_company: deal.prospect_company ?? '', prospect_phone: deal.prospect_phone ?? '',
    prospect_email: deal.prospect_email ?? '', value: deal.value != null ? String(deal.value) : '',
    expected_close: '', notes: '',
  });

  function setEF(k: keyof typeof editForm, v: string) { setEditForm(f => ({ ...f, [k]: v })); }

  async function deleteDeal() {
    setDeleting(true);
    const res = await fetch(`/api/crm/deals/${deal.id}`, { method: 'DELETE' });
    setDeleting(false);
    if (!res.ok) { alert('Kunne ikke slette leadet (kun admin kan slette).'); return; }
    onDeleted();
  }

  async function saveEdit() {
    setEditSaving(true);
    await fetch(`/api/crm/deals/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editForm.title || undefined,
        prospect_name: editForm.prospect_name || undefined,
        prospect_company: editForm.prospect_company || undefined,
        prospect_phone: editForm.prospect_phone || undefined,
        prospect_email: editForm.prospect_email || undefined,
        value: editForm.value !== '' ? Number(editForm.value) : undefined,
      }),
    });
    setEditSaving(false);
    setEditing(false);
    onUpdated();
  }

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetch(`/api/crm/deals/${deal.id}`).then(r => r.json()) as { deal: Deal; touchpoints: Touchpoint[]; products: DealProduct[] };
    if (Array.isArray(data.touchpoints)) setTouchpoints(data.touchpoints);
    if (Array.isArray(data.products)) setProducts(data.products);
    setLoading(false);
  }, [deal.id]);

  useEffect(() => { load(); }, [load]);

  async function changeStage(stage: string) {
    if (stage === 'tabt') { setShowLostPrompt(true); return; }
    await fetch(`/api/crm/deals/${deal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage }) });
    onStageChange(stage);
  }

  async function confirmLost() {
    await fetch(`/api/crm/deals/${deal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: 'tabt', lost_reason: lostReason || null }) });
    setShowLostPrompt(false);
    onStageChange('tabt');
  }

  async function saveCountry(country: string) {
    await fetch(`/api/crm/deals/${deal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ country }) });
    onUpdated();
  }

  async function saveCompany(company_id: number | null) {
    await fetch(`/api/crm/deals/${deal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id }) });
    onUpdated();
  }

  const groups    = groupByDate(touchpoints);
  const stageInfo = stages.find(s => s.key === deal.stage);

  return (
    <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 500, background: 'var(--s1)', borderLeft: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', zIndex: 300, boxShadow: '-20px 0 60px rgba(0,0,0,0.4)' }}>
      {/* Lost reason prompt */}
      {showLostPrompt && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--s1)', borderRadius: 12, padding: 20, width: '100%', maxWidth: 360 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 12 }}>Årsag til tab? (valgfrit)</div>
            <input value={lostReason} onChange={e => setLostReason(e.target.value)} placeholder="Pris, konkurrent, ikke relevant…" style={{ width: '100%', marginBottom: 12 }} autoFocus />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowLostPrompt(false)} style={{ flex: 1, padding: '8px 0', borderRadius: 7, background: 'var(--s2)', color: 'var(--t3)', border: '1px solid var(--bd)', fontSize: 12 }}>Annuller</button>
              <button onClick={confirmLost} style={{ flex: 2, padding: '8px 0', borderRadius: 7, background: 'var(--re)', color: '#fff', fontSize: 12, fontWeight: 700 }}>Marker som tabt</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rediger deal</span>
              <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--s2)', color: 'var(--t3)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--bd)', flexShrink: 0 }}>×</button>
            </div>
            <div><label>Titel</label><input value={editForm.title} onChange={e => setEF('title', e.target.value)} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label>Kontaktnavn</label><input value={editForm.prospect_name} onChange={e => setEF('prospect_name', e.target.value)} placeholder="Jens Jensen" /></div>
              <div><label>Firma</label><input value={editForm.prospect_company} onChange={e => setEF('prospect_company', e.target.value)} placeholder="Firma A/S" /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label>Telefon</label><input value={editForm.prospect_phone} onChange={e => setEF('prospect_phone', e.target.value)} placeholder="+45 12 34 56 78" /></div>
              <div><label>Email</label><input type="email" value={editForm.prospect_email} onChange={e => setEF('prospect_email', e.target.value)} placeholder="jens@firma.dk" /></div>
            </div>
            <div><label>Værdi (kr)</label><input type="number" value={editForm.value} onChange={e => setEF('value', e.target.value)} placeholder="0" /></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveEdit} disabled={editSaving} style={{ flex: 1, background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 0', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: editSaving ? 0.6 : 1 }}>{editSaving ? 'Gemmer…' : 'Gem'}</button>
              <button onClick={() => { setEditing(false); setEditForm({ title: deal.title, prospect_name: deal.prospect_name ?? '', prospect_company: deal.prospect_company ?? '', prospect_phone: deal.prospect_phone ?? '', prospect_email: deal.prospect_email ?? '', value: deal.value != null ? String(deal.value) : '', expected_close: '', notes: '' }); }} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}>Annuller</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>{deal.title}</div>
                {(deal.prospect_name || deal.prospect_company) && (
                  <div style={{ fontSize: 12, color: 'var(--t2)' }}>
                    {deal.prospect_name}{deal.prospect_company ? ` · ${deal.prospect_company}` : ''}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                {showDeleteConfirm ? (
                  <>
                    <span style={{ fontSize: 11, color: 'var(--re)' }}>Slet permanent?</span>
                    <button onClick={deleteDeal} disabled={deleting} style={{ height: 28, borderRadius: 7, background: 'var(--re)', color: '#fff', fontSize: 11, padding: '0 10px', border: 'none', cursor: 'pointer', opacity: deleting ? 0.6 : 1 }}>{deleting ? '…' : 'Ja, slet'}</button>
                    <button onClick={() => setShowDeleteConfirm(false)} style={{ height: 28, borderRadius: 7, background: 'var(--s2)', color: 'var(--t3)', fontSize: 11, padding: '0 10px', border: '1px solid var(--bd)', cursor: 'pointer' }}>Fortryd</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setShowDeleteConfirm(true)} style={{ height: 28, borderRadius: 7, background: 'none', color: 'var(--re)', fontSize: 11, padding: '0 10px', border: '1px solid var(--bd)', cursor: 'pointer', opacity: 0.8 }}>Slet lead</button>
                    <button onClick={() => setEditing(true)} style={{ height: 28, borderRadius: 7, background: 'var(--s2)', color: 'var(--t3)', fontSize: 11, padding: '0 10px', border: '1px solid var(--bd)', cursor: 'pointer' }}>Rediger</button>
                    <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--s2)', color: 'var(--t3)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--bd)', flexShrink: 0 }}>×</button>
                  </>
                )}
              </div>
            </div>

            {/* Meta row */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={deal.stage} onChange={e => changeStage(e.target.value)} style={{ fontSize: 11, padding: '4px 8px', background: stageInfo ? `${stageInfo.color}22` : 'var(--s2)', border: `1px solid ${stageInfo?.color ?? 'var(--bd2)'}44`, borderRadius: 6, color: stageInfo?.color ?? 'var(--t2)', fontWeight: 700, width: 'auto' }}>
                {stages.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              {deal.value && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gr)' }}>{fmt(Number(deal.value))}</span>}
              {deal.prospect_phone && (
                <a href={`tel:${deal.prospect_phone}`} style={{ fontSize: 11, color: 'var(--bl)', textDecoration: 'none', padding: '4px 8px', background: 'var(--bl2)', borderRadius: 6 }}>📞 {deal.prospect_phone}</a>
              )}
              {deal.prospect_email && (
                <a href={`mailto:${deal.prospect_email}`} style={{ fontSize: 11, color: 'var(--bl)', textDecoration: 'none', padding: '4px 8px', background: 'var(--bl2)', borderRadius: 6 }}>✉ {deal.prospect_email}</a>
              )}
            </div>
          </>
        )}

        {/* Country + Portfolio company */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Land</div>
            <CountryPicker value={deal.country ?? 'DK'} onChange={saveCountry} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Tilknyttet firma</div>
            <select value={deal.company_id ?? ''} onChange={e => saveCompany(e.target.value ? Number(e.target.value) : null)}
              style={{ width: '100%', fontSize: 12, padding: '6px 8px' }}>
              <option value="">Intet firma</option>
              {portfolioCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* Products */}
        <ProductSelector dealId={deal.id} products={products} ownProducts={ownProducts} onRefresh={load} />
      </div>

      {/* Timeline */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
        <LogActivityForm dealId={deal.id} dealValue={deal.value} onSaved={load} />

        {deal.stage === 'tabt' && deal.lost_reason && (
          <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--re2)', borderRadius: 8, fontSize: 11, color: 'var(--re)' }}>
            Tabsårsag: {deal.lost_reason}
          </div>
        )}

        {loading && <div style={{ color: 'var(--t3)', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>Indlæser…</div>}

        {!loading && touchpoints.length === 0 && (
          <div style={{ color: 'var(--t3)', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>
            Ingen aktiviteter endnu.<br />Log den første handling ovenfor.
          </div>
        )}

        {!loading && groups.map(g => (
          <div key={g.label}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', padding: '12px 0 4px' }}>{g.label}</div>
            {g.items.map(t => <TouchpointEntry key={t.id} t={t} onRefresh={load} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Deal Card ─────────────────────────────────────── */
function DealCard({ deal, stages, selected, onClick, isWon, isLost }: {
  deal: Deal; stages: Stage[]; selected: boolean; onClick: () => void; isWon?: boolean; isLost?: boolean;
}) {
  const stageInfo = stages.find(s => s.key === deal.stage);
  const na        = deal.next_action_entry;
  const naOverdue = na && isOverdue(na.next_action_date);
  const borderColor = isWon ? 'var(--gr)' : isLost ? 'var(--re)' : stageInfo?.color ?? 'var(--t3)';
  // deal.products can come back as the raw crm_deals.products column (a plain
  // string[] of product names, written by the shared Meridian CRM) instead of
  // the { id, name, price, type }[] this card expects — guard against both
  // shapes and anything that isn't an array at all.
  const products: (DealProduct | string)[] = Array.isArray(deal.products) ? deal.products : [];

  return (
    <div onClick={onClick} style={{ background: 'var(--s2)', border: `1px solid ${selected ? 'var(--bl)' : 'var(--bd)'}`, borderRadius: 9, padding: '11px 13px', marginBottom: 8, cursor: 'pointer', borderLeft: `3px solid ${borderColor}`, opacity: (isWon || isLost) ? 0.75 : 1, transition: 'border-color 0.15s' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>{deal.title}</div>
      {(deal.prospect_name || deal.prospect_company) && (
        <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>{deal.prospect_name || deal.prospect_company}</div>
      )}

      {/* Tags row */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
        {deal.country && deal.country !== 'DK' && (
          <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'var(--s3)', color: 'var(--t3)' }}>{flag(deal.country)} {deal.country}</span>
        )}
        {deal.portfolio_company_name && (
          <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'var(--s3)', color: 'var(--t2)', fontWeight: 600 }}>{deal.portfolio_company_name}</span>
        )}
        {products.slice(0, 2).map((p, i) => (
          <span key={typeof p === 'string' ? p : p.id ?? i} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 100, background: 'var(--pu2)', color: 'var(--pu)', fontWeight: 600 }}>{typeof p === 'string' ? p : p.name}</span>
        ))}
        {products.length > 2 && (
          <span style={{ fontSize: 10, color: 'var(--t3)' }}>+{products.length - 2}</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {deal.value && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gr)' }}>{fmt(Number(deal.value))}</span>}
        <span style={{ fontSize: 10, color: 'var(--t3)', background: 'var(--s3)', padding: '1px 6px', borderRadius: 4 }}>{deal.touchpoint_count} akt.</span>
      </div>
      {na && (
        <div style={{ marginTop: 6, fontSize: 10, color: naOverdue ? 'var(--re)' : 'var(--or)', background: naOverdue ? 'var(--re2)' : 'var(--or2)', padding: '3px 8px', borderRadius: 100, display: 'inline-block' }}>
          {naOverdue ? '⚠ ' : ''}{TYPE_META[na.type]?.icon} {na.next_action}{na.next_action_date ? ` · ${fmtDate(na.next_action_date)}` : ''}
        </div>
      )}
      {isLost && deal.lost_reason && (
        <div style={{ marginTop: 4, fontSize: 10, color: 'var(--re)', opacity: 0.8 }}>Tabt: {deal.lost_reason}</div>
      )}
    </div>
  );
}

/* ── New Deal Modal ─────────────────────────────────── */
function NewDealModal({ stages, ownProducts, portfolioCompanies, onClose, onCreated }: {
  stages: Stage[]; ownProducts: CrmProduct[]; portfolioCompanies: PortfolioCompany[];
  onClose: () => void; onCreated: (d: Deal) => void;
}) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: '', prospect_name: '', prospect_company: '', prospect_phone: '', prospect_email: '',
    value: '', stage: stages.find(s => !s.is_won && !s.is_lost)?.key ?? 'lead',
    expected_close: '', notes: '', country: 'DK', company_id: '',
  });
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function toggleProduct(id: number) {
    setSelectedProductIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]);
  }

  const calcValue = ownProducts
    .filter(p => selectedProductIds.includes(p.id))
    .reduce((s, p) => s + Number(p.price ?? 0), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/crm/deals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          value: form.value ? Number(form.value) : (calcValue || null),
          company_id: form.company_id ? Number(form.company_id) : null,
          product_ids: selectedProductIds,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Ukendt fejl' }));
        setError(body.error ?? 'Noget gik galt');
        setSaving(false);
        return;
      }
      const deal = await res.json() as Deal;
      setSaving(false);
      onCreated(deal);
    } catch {
      setError('Netværksfejl — prøv igen');
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--s1)', borderRadius: 13, padding: 24, width: 500, maxWidth: '94vw', boxShadow: '0 40px 80px rgba(0,0,0,0.7)', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--bd)' }}>
          {['Grundinfo', 'Prospect', 'Tilknytning'].map((label, i) => (
            <button key={i} type="button" onClick={() => setStep(i + 1)}
              style={{ flex: 1, padding: '8px 0', fontSize: 11, fontWeight: step === i + 1 ? 700 : 400, background: step === i + 1 ? 'var(--bl)' : 'var(--s2)', color: step === i + 1 ? '#fff' : 'var(--t3)', border: 'none', cursor: 'pointer', borderRight: i < 2 ? '1px solid var(--bd)' : 'none' }}>
              {i + 1}. {label}
            </button>
          ))}
        </div>

        <form onSubmit={submit}>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label>Titel *</label><input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Tandlæge Svendsen — AI Receptionist" required autoFocus /></div>
              <div>
                <label>Stage</label>
                <select value={form.stage} onChange={e => set('stage', e.target.value)}>
                  {stages.filter(s => !s.is_won && !s.is_lost).map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label>Dealværdi (DKK)</label><input type="number" value={form.value || (calcValue || '')} onChange={e => set('value', e.target.value)} placeholder={calcValue ? String(calcValue) : '50000'} /></div>
                <div><label>Forventet lukning</label><input type="date" value={form.expected_close} onChange={e => set('expected_close', e.target.value)} /></div>
              </div>
              <div><label>Noter</label><textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label>Navn</label><input value={form.prospect_name} onChange={e => set('prospect_name', e.target.value)} placeholder="Jens Jensen" /></div>
                <div><label>Firma</label><input value={form.prospect_company} onChange={e => set('prospect_company', e.target.value)} placeholder="Jensen A/S" /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label>Telefon</label><input value={form.prospect_phone} onChange={e => set('prospect_phone', e.target.value)} placeholder="+45 12 34 56 78" /></div>
                <div><label>Email</label><input type="email" value={form.prospect_email} onChange={e => set('prospect_email', e.target.value)} placeholder="jens@firma.dk" /></div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label>Land</label>
                <CountryPicker value={form.country} onChange={v => set('country', v)} />
              </div>
              <div>
                <label>Tilknyttet firma (portfolio)</label>
                <select value={form.company_id} onChange={e => set('company_id', e.target.value)} style={{ width: '100%' }}>
                  <option value="">Ingen</option>
                  {portfolioCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ marginBottom: 6, display: 'block' }}>Produkter</label>
                {ownProducts.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--t3)' }}>Ingen produkter endnu. <a href="/admin/crm/products" style={{ color: 'var(--bl)' }}>Opret dit første produkt →</a></div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {ownProducts.map(p => (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', marginBottom: 0, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                        <input type="checkbox" checked={selectedProductIds.includes(p.id)} onChange={() => toggleProduct(p.id)} style={{ width: 'auto', marginRight: 4 }} />
                        <span style={{ flex: 1 }}>{p.name}</span>
                        {p.price != null && <span style={{ color: 'var(--gr)', fontWeight: 600 }}>{fmt(Number(p.price))}{p.type === 'monthly' ? '/md.' : ''}</span>}
                      </label>
                    ))}
                    {calcValue > 0 && (
                      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--gr)', fontWeight: 600 }}>Samlet: {fmt(calcValue)}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 7, fontSize: 12, color: 'var(--re)' }}>{error}</div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {step > 1 && <button type="button" onClick={() => setStep(s => s - 1)} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12 }}>← Forrige</button>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={onClose} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12 }}>Annuller</button>
              {step < 3
                ? <button type="button" onClick={() => setStep(s => s + 1)} disabled={step === 1 && !form.title.trim()} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600 }}>Næste →</button>
                : <button type="submit" disabled={saving || !form.title.trim()} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600 }}>{saving ? 'Opretter…' : 'Opret lead'}</button>
              }
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main Board ────────────────────────────────────── */
export default function CrmBoard() {
  const [deals, setDeals]           = useState<Deal[]>([]);
  const [stages, setStages]         = useState<Stage[]>([]);
  const [ownProducts, setOwnProducts] = useState<CrmProduct[]>([]);
  const [portfolioCompanies, setPortfolioCompanies] = useState<PortfolioCompany[]>([]);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showNewDeal, setShowNewDeal]   = useState(false);
  const [showStageEditor, setShowStageEditor] = useState(false);
  const [toast, setToast]           = useState('');
  const [loading, setLoading]       = useState(true);

  // Filter state
  const [filterCountry, setFilterCountry]     = useState('');
  const [filterCompany, setFilterCompany]     = useState('');
  const [filterWorkspace, setFilterWorkspace] = useState(''); // '' = alle selskaber (koncern-wide default)
  const [wonCollapsed, setWonCollapsed]     = useState(true);
  const [lostCollapsed, setLostCollapsed]   = useState(true);

  async function loadDeals() {
    try {
      const sp = new URLSearchParams({ status: 'open' });
      if (filterCountry) sp.set('country', filterCountry);
      if (filterCompany) sp.set('company_id', filterCompany);
      if (filterWorkspace) sp.set('workspace', filterWorkspace);
      const res = await fetch(`/api/crm/deals?${sp}`);
      const rows = await res.json() as Deal[];
      if (Array.isArray(rows)) {
        setDeals(rows);
        setSelectedDeal(prev => prev ? (rows.find(d => d.id === prev.id) ?? prev) : null);
      }
    } catch { /* ignore — page stays empty until next reload */ }
  }
  async function loadStages() {
    try {
      const rows = await fetch('/api/crm/stages').then(r => r.json()) as Stage[];
      if (Array.isArray(rows)) setStages(rows);
    } catch { /* ignore */ }
  }
  async function loadProducts() {
    try {
      const rows = await fetch('/api/crm/products').then(r => r.json()) as CrmProduct[];
      if (Array.isArray(rows)) setOwnProducts(rows);
    } catch { /* ignore */ }
  }
  async function loadCompanies() {
    try {
      const rows = await fetch('/api/companies').then(r => r.json()) as PortfolioCompany[];
      if (Array.isArray(rows)) setPortfolioCompanies(rows);
    } catch { /* ignore */ }
  }

  async function loadAll() {
    setLoading(true);
    try {
      await fetch('/api/crm/migrate', { method: 'POST' });
      await Promise.all([loadDeals(), loadStages(), loadProducts(), loadCompanies()]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-filter when filters change
  useEffect(() => {
    if (!loading) loadDeals();
  // eslint-disable-line react-hooks/exhaustive-deps
  }, [filterCountry, filterCompany, filterWorkspace]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleStageChange(stage: string) {
    if (!selectedDeal) return;
    setSelectedDeal(d => d ? { ...d, stage } : null);
    setDeals(ds => ds.map(d => d.id === selectedDeal.id ? { ...d, stage } : d));
    if (stage === 'vundet') setToast('🎉 Deal vundet!');
  }

  function handleDealCreated(deal: Deal) {
    setDeals(ds => [deal, ...ds]);
    setShowNewDeal(false);
    setSelectedDeal(deal);
    setToast('Lead oprettet');
  }

  const openStages  = stages.filter(s => !s.is_won && !s.is_lost);
  const wonStage    = stages.find(s => s.is_won);
  const lostStage   = stages.find(s => s.is_lost);
  const wonDeals    = deals.filter(d => d.stage === (wonStage?.key ?? 'vundet'));
  const lostDeals   = deals.filter(d => d.stage === (lostStage?.key ?? 'tabt'));
  const openDeals   = deals.filter(d => d.stage !== (wonStage?.key ?? 'vundet') && d.stage !== (lostStage?.key ?? 'tabt'));
  const wonTotal    = wonDeals.reduce((s, d) => s + Number(d.value ?? 0), 0);
  // Deals whose stage key matches none of the visible columns (e.g. a stage that was
  // deleted, or — for ADMIN's cross-owner view — another user's custom stage key).
  // Without this they'd silently disappear from the board while still existing in the DB.
  const unmatchedDeals = openDeals.filter(d => !openStages.find(s => s.key === d.stage));

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      {/* Pipeline */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: 'var(--s1)', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>Pipeline</h1>
          <span style={{ fontSize: 12, color: 'var(--t3)' }}>{openDeals.length} åbne</span>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 8 }}>
            <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)} style={{ fontSize: 11, padding: '5px 8px', width: 'auto', minWidth: 120 }}>
              <option value="">🌍 Alle lande</option>
              {[...PRIORITY_COUNTRIES, ...ALL_COUNTRIES.filter(c => !PRIORITY_COUNTRIES.find(p => p.code === c.code))].map(c => (
                <option key={c.code} value={c.code}>{flag(c.code)} {c.name}</option>
              ))}
            </select>
            <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} style={{ fontSize: 11, padding: '5px 8px', width: 'auto', minWidth: 130 }}>
              <option value="">Alle firmaer</option>
              {portfolioCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filterWorkspace} onChange={e => setFilterWorkspace(e.target.value)} style={{ fontSize: 11, padding: '5px 8px', width: 'auto', minWidth: 140 }} title="Hvilket selskabs pipeline">
              <option value="">Alle selskaber</option>
              <option value="group">NextLevel Group</option>
              <option value="meridian">Meridian</option>
            </select>
            {(filterCountry || filterCompany || filterWorkspace) && (
              <button onClick={() => { setFilterCountry(''); setFilterCompany(''); setFilterWorkspace(''); }} style={{ fontSize: 10, color: 'var(--re)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>✕ Ryd</button>
            )}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={() => setShowStageEditor(true)} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '7px 12px', fontSize: 11 }}>
              Rediger pipeline
            </button>
            <button onClick={() => setShowNewDeal(true)} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600 }}>
              + Nyt lead
            </button>
          </div>
        </div>

        {/* Kanban */}
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', display: 'flex', padding: '16px 16px', gap: 10 }}>
          {loading && <div style={{ color: 'var(--t3)', fontSize: 13, padding: '40px 0', width: '100%', textAlign: 'center' }}>Indlæser…</div>}

          {/* Open stages */}
          {!loading && openStages.map(stage => {
            const stageDeals = openDeals.filter(d => d.stage === stage.key);
            const totalVal   = stageDeals.reduce((s, d) => s + (d.value ? Number(d.value) : 0), 0);
            return (
              <div key={stage.key} style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{stage.label}</span>
                  <span style={{ fontSize: 10, color: 'var(--t3)', background: 'var(--s2)', padding: '1px 6px', borderRadius: 100 }}>{stageDeals.length}</span>
                  {totalVal > 0 && <span style={{ fontSize: 10, color: 'var(--gr)', marginLeft: 'auto' }}>{fmt(totalVal)}</span>}
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {stageDeals.map(deal => (
                    <DealCard key={deal.id} deal={deal} stages={stages} selected={selectedDeal?.id === deal.id} onClick={() => setSelectedDeal(selectedDeal?.id === deal.id ? null : deal)} />
                  ))}
                  {stageDeals.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--t4)', textAlign: 'center', padding: '20px 0', border: '1px dashed var(--bd)', borderRadius: 8 }}>Tom</div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Fallback column: deals whose stage doesn't match any known column */}
          {!loading && unmatchedDeals.length > 0 && (
            <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--t3)' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Andet</span>
                <span style={{ fontSize: 10, color: 'var(--t3)', background: 'var(--s2)', padding: '1px 6px', borderRadius: 100 }}>{unmatchedDeals.length}</span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {unmatchedDeals.map(deal => (
                  <DealCard key={deal.id} deal={deal} stages={stages} selected={selectedDeal?.id === deal.id} onClick={() => setSelectedDeal(selectedDeal?.id === deal.id ? null : deal)} />
                ))}
              </div>
            </div>
          )}

          {/* Won + Lost columns side by side, collapsed by default */}
          {!loading && (wonStage || lostStage) && (
            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              {/* Vundet */}
              {wonStage && (
                <div style={{ width: wonCollapsed ? 140 : 200, flexShrink: 0, display: 'flex', flexDirection: 'column', transition: 'width 0.2s' }}>
                  <button onClick={() => setWonCollapsed(c => !c)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gr)', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gr)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Vundet ✓</span>
                    <span style={{ fontSize: 10, color: 'var(--t3)', background: 'var(--gr2)', padding: '1px 6px', borderRadius: 100 }}>{wonDeals.length}</span>
                    {wonTotal > 0 && !wonCollapsed && <span style={{ fontSize: 10, color: 'var(--gr)', marginLeft: 'auto' }}>{fmt(wonTotal)}</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--t4)' }}>{wonCollapsed ? '▼' : '▲'}</span>
                  </button>
                  {!wonCollapsed && (
                    <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,255,0,0.02)', borderRadius: 8, padding: '4px 0' }}>
                      {wonDeals.map(deal => (
                        <DealCard key={deal.id} deal={deal} stages={stages} selected={selectedDeal?.id === deal.id} onClick={() => setSelectedDeal(selectedDeal?.id === deal.id ? null : deal)} isWon />
                      ))}
                    </div>
                  )}
                  {wonCollapsed && wonDeals.length > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--gr)', textAlign: 'center', paddingTop: 4 }}>{fmt(wonTotal)}</div>
                  )}
                </div>
              )}

              {/* Tabt */}
              {lostStage && (
                <div style={{ width: lostCollapsed ? 130 : 200, flexShrink: 0, display: 'flex', flexDirection: 'column', transition: 'width 0.2s' }}>
                  <button onClick={() => setLostCollapsed(c => !c)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--re)', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--re)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tabt ✗</span>
                    <span style={{ fontSize: 10, color: 'var(--t3)', background: 'var(--re2)', padding: '1px 6px', borderRadius: 100 }}>{lostDeals.length}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--t4)' }}>{lostCollapsed ? '▼' : '▲'}</span>
                  </button>
                  {!lostCollapsed && (
                    <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(255,0,0,0.02)', borderRadius: 8, padding: '4px 0' }}>
                      {lostDeals.map(deal => (
                        <DealCard key={deal.id} deal={deal} stages={stages} selected={selectedDeal?.id === deal.id} onClick={() => setSelectedDeal(selectedDeal?.id === deal.id ? null : deal)} isLost />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedDeal && (
        <DealPanel
          deal={selectedDeal}
          stages={stages}
          ownProducts={ownProducts}
          portfolioCompanies={portfolioCompanies}
          onClose={() => setSelectedDeal(null)}
          onStageChange={handleStageChange}
          onUpdated={loadDeals}
          onDeleted={() => { setSelectedDeal(null); setToast('Lead slettet'); loadDeals(); }}
        />
      )}

      {showNewDeal && (
        <NewDealModal
          stages={stages}
          ownProducts={ownProducts}
          portfolioCompanies={portfolioCompanies}
          onClose={() => setShowNewDeal(false)}
          onCreated={handleDealCreated}
        />
      )}

      {showStageEditor && stages.length > 0 && (
        <StageEditorModal
          stages={stages}
          onClose={() => setShowStageEditor(false)}
          onSaved={() => { loadStages(); loadDeals(); }}
        />
      )}
    </div>
  );
}
