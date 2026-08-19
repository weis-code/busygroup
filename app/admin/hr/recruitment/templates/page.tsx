'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Template { id: number; name: string; company_id: number | null; company_name: string | null; created_at: string; item_count: number }
interface TemplateItem { id: number; template_id: number; title: string; description: string | null; position: number; days_before_start: number }
interface Company { id: number; name: string; slug: string; color: string }

export default function ChecklistTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [t, c] = await Promise.all([
      fetch('/api/hr/checklist-templates').then(r => r.json()),
      fetch('/api/companies').then(r => r.json()),
    ]);
    setTemplates(Array.isArray(t) ? t : []);
    setCompanies(Array.isArray(c) ? c : []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function deleteTemplate(id: number) {
    if (!confirm('Slet denne skabelon?')) return;
    await fetch(`/api/hr/checklist-templates/${id}`, { method: 'DELETE' });
    void load();
  }

  return (
    <div style={{ padding: '20px 24px', maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div>
          <Link href="/admin/hr/recruitment" style={{ fontSize: 11, color: 'var(--t3)', textDecoration: 'none' }}>← Rekruttering</Link>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', marginTop: 4 }}>Tjeklisteskabeloner</h1>
        </div>
        <button onClick={() => setEditingId('new')} style={{ marginLeft: 'auto', background: 'var(--bl)', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
          + Ny skabelon
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--t3)', fontSize: 13, padding: '20px 0' }}>Indlæser…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {templates.map(t => (
            <div key={t.id} onClick={() => setEditingId(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 9, cursor: 'pointer' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{t.name}</div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>{t.company_name ?? 'Alle firmaer'} · {t.item_count} {t.item_count === 1 ? 'opgave' : 'opgaver'}</div>
              </div>
              <button onClick={e => { e.stopPropagation(); void deleteTemplate(t.id); }}
                style={{ background: 'var(--re2)', color: 'var(--re)', border: '1px solid var(--re)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>
                Slet
              </button>
            </div>
          ))}
          {templates.length === 0 && <div style={{ fontSize: 12, color: 'var(--t3)' }}>Ingen skabeloner endnu</div>}
        </div>
      )}

      {editingId !== null && (
        <TemplateEditorModal
          templateId={editingId === 'new' ? null : editingId}
          companies={companies}
          onClose={() => setEditingId(null)}
          onSaved={() => { setEditingId(null); void load(); }}
        />
      )}
    </div>
  );
}

function TemplateEditorModal({ templateId, companies, onClose, onSaved }: {
  templateId: number | null; companies: Company[]; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDays, setNewDays] = useState(0);
  const [saving, setSaving] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(templateId);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    if (templateId === null) return;
    fetch(`/api/hr/checklist-templates/${templateId}/items`).then(r => r.json()).then(setItems);
    fetch('/api/hr/checklist-templates').then(r => r.json()).then((all: Template[]) => {
      const t = all.find(x => x.id === templateId);
      if (t) { setName(t.name); setCompanyId(t.company_id ? String(t.company_id) : ''); }
    });
  }, [templateId]);

  async function ensureTemplate(): Promise<number> {
    if (currentId !== null) return currentId;
    const res = await fetch('/api/hr/checklist-templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() || 'Ny skabelon', company_id: companyId ? Number(companyId) : null }),
    });
    const t = await res.json() as { id: number };
    setCurrentId(t.id);
    return t.id;
  }

  async function saveMeta() {
    const id = await ensureTemplate();
    await fetch(`/api/hr/checklist-templates/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() || 'Ny skabelon', company_id: companyId ? Number(companyId) : null }),
    });
  }

  async function addItem() {
    if (!newTitle.trim()) return;
    const id = await ensureTemplate();
    const res = await fetch(`/api/hr/checklist-templates/${id}/items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim(), days_before_start: newDays }),
    });
    const item = await res.json() as TemplateItem;
    setItems(prev => [...prev, item]);
    setNewTitle(''); setNewDays(0);
  }

  async function updateItem(itemId: number, body: Record<string, unknown>) {
    if (currentId === null) return;
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, ...body } as TemplateItem : i));
    await fetch(`/api/hr/checklist-templates/${currentId}/items/${itemId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  }

  async function deleteItem(itemId: number) {
    if (currentId === null) return;
    setItems(prev => prev.filter(i => i.id !== itemId));
    await fetch(`/api/hr/checklist-templates/${currentId}/items/${itemId}`, { method: 'DELETE' });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || currentId === null) return;
    const oldIndex = items.findIndex(i => i.id === Number(active.id));
    const newIndex = items.findIndex(i => i.id === Number(over.id));
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);
    await Promise.all(reordered.map((item, idx) =>
      item.position === idx ? null : fetch(`/api/hr/checklist-templates/${currentId}/items/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ position: idx }),
      })
    ));
    setItems(reordered.map((item, idx) => ({ ...item, position: idx })));
  }

  async function finish() {
    setSaving(true);
    await saveMeta();
    setSaving(false);
    onSaved();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--s1)', borderRadius: 13, padding: 24, width: 480, maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 20 }}>{templateId === null ? 'Ny skabelon' : 'Rediger skabelon'}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
          <div><label>Skabelon navn</label><input value={name} onChange={e => setName(e.target.value)} onBlur={() => void saveMeta()} placeholder='fx "Standard NLS Sælger"' autoFocus /></div>
          <div>
            <label>Firma</label>
            <select value={companyId} onChange={e => { setCompanyId(e.target.value); void saveMeta(); }}>
              <option value="">Alle firmaer</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>OPGAVER</div>
        <DndContext sensors={sensors} onDragEnd={e => void handleDragEnd(e)}>
          <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {items.map(item => (
                <SortableItemRow key={item.id} item={item} onChange={body => void updateItem(item.id, body)} onDelete={() => void deleteItem(item.id)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void addItem(); }}
            placeholder="Titel" style={{ flex: 1, fontSize: 12 }} />
          <input type="number" value={newDays} onChange={e => setNewDays(Number(e.target.value))}
            title="Dage før opstart" style={{ width: 70, fontSize: 12 }} />
          <button onClick={() => void addItem()} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}>+ Tilføj</button>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12 }}>Luk</button>
          <button onClick={() => void finish()} disabled={saving} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 18px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            {saving ? 'Gemmer…' : 'Færdig'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableItemRow({ item, onChange, onDelete }: {
  item: TemplateItem; onChange: (body: Record<string, unknown>) => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const [title, setTitle] = useState(item.title);
  const [days, setDays] = useState(item.days_before_start);

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '6px 8px' }}>
      <span {...attributes} {...listeners} style={{ cursor: 'grab', color: 'var(--t3)', fontSize: 13, padding: '0 4px' }}>⠿</span>
      <input value={title} onChange={e => setTitle(e.target.value)} onBlur={() => onChange({ title })} style={{ flex: 1, fontSize: 12, background: 'transparent', border: 'none' }} />
      <input type="number" value={days} onChange={e => setDays(Number(e.target.value))} onBlur={() => onChange({ days_before_start: days })}
        title="Dage før opstart" style={{ width: 60, fontSize: 12, background: 'transparent', border: 'none', textAlign: 'right' }} />
      <span style={{ fontSize: 10, color: 'var(--t3)' }}>dage før</span>
      <button onClick={onDelete} style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 13, cursor: 'pointer', padding: '0 4px' }}>×</button>
    </div>
  );
}
