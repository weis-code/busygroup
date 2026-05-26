'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Trash2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/lib/UserContext';

const STAGES = [
  { key: 'new',        label: 'Ny',           color: '#94A3B8', bg: 'rgba(148,163,184,0.1)'  },
  { key: 'contacted',  label: 'Kontaktet',    color: '#3B82F6', bg: 'rgba(59,130,246,0.08)'  },
  { key: 'interested', label: 'Interesseret', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)'  },
  { key: 'proposal',   label: 'Tilbud sendt', color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)'  },
  { key: 'won',        label: 'Vundet',       color: '#10B981', bg: 'rgba(16,185,129,0.08)'  },
  { key: 'lost',       label: 'Tabt',         color: '#EF4444', bg: 'rgba(239,68,68,0.06)'   },
] as const;
type StageKey = typeof STAGES[number]['key'];

interface CrmLead {
  id: string; company: string;
  contact_name: string | null; contact_email: string | null; contact_phone: string | null;
  status: StageKey; product_id: string | null; product_name: string | null;
  deal_value: number; notes: string | null;
  assigned_to: string | null; assigned_name: string | null;
  created_at: string; updated_at: string;
}
interface Product { id: string; name: string; price: number; type: string; }
interface User { id: string; name: string; }

const fmtDKK = (n: number) =>
  new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }).format(n);

const inputStyle: React.CSSProperties = {
  background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 7, padding: '8px 11px', color: '#1E293B',
  fontSize: 13, width: '100%', outline: 'none', boxSizing: 'border-box',
};

const emptyForm = {
  company: '', contact_name: '', contact_email: '', contact_phone: '',
  status: 'new' as StageKey, product_id: '', deal_value: '', notes: '', assigned_to: '',
};

export default function CrmPage() {
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';

  const [leads, setLeads]       = useState<CrmLead[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers]       = useState<User[]>([]);
  const [loading, setLoading]   = useState(true);
  const [sellerFilter, setSellerFilter] = useState('');

  // Modal state — null = closed, otherwise the lead being edited (or 'new')
  const [modal, setModal]     = useState<CrmLead | 'new' | null>(null);
  const [form, setForm]       = useState(emptyForm);
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const [leadsRes, productsRes, usersRes] = await Promise.all([
      fetch('/api/crm/leads').then(r => r.ok ? r.json() : []),
      fetch('/api/products').then(r => r.ok ? r.json() : []),
      isAdmin ? fetch('/api/users').then(r => r.ok ? r.json() : []) : Promise.resolve([]),
    ]);
    setLeads(Array.isArray(leadsRes) ? leadsRes : []);
    setProducts(Array.isArray(productsRes) ? productsRes : []);
    setUsers(Array.isArray(usersRes) ? usersRes : []);
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setForm({ ...emptyForm, assigned_to: user?.id || '' });
    setModal('new');
  };

  const openLead = (lead: CrmLead) => {
    setForm({
      company:       lead.company,
      contact_name:  lead.contact_name  || '',
      contact_email: lead.contact_email || '',
      contact_phone: lead.contact_phone || '',
      status:        lead.status,
      product_id:    lead.product_id    || '',
      deal_value:    lead.deal_value > 0 ? String(lead.deal_value) : '',
      notes:         lead.notes         || '',
      assigned_to:   lead.assigned_to   || '',
    });
    setModal(lead);
  };

  const closeModal = () => { setModal(null); };

  const editingId = modal !== null && modal !== 'new' ? (modal as CrmLead).id : null;

  const save = async () => {
    if (!form.company.trim()) { toast.error('Firmanavn er påkrævet'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        deal_value:    Number(form.deal_value) || 0,
        product_id:    form.product_id    || null,
        contact_name:  form.contact_name  || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        notes:         form.notes         || null,
        assigned_to:   form.assigned_to   || null,
      };
      const url    = editingId ? `/api/crm/leads/${editingId}` : '/api/crm/leads';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      const saved: CrmLead = await res.json();
      if (editingId) {
        setLeads(prev => prev.map(l => l.id === editingId ? saved : l));
        toast.success('Lead opdateret');
      } else {
        setLeads(prev => [saved, ...prev]);
        toast.success('Lead oprettet');
      }
      closeModal();
    } catch { toast.error('Noget gik galt'); }
    finally { setSaving(false); }
  };

  const deleteLead = async () => {
    if (!editingId || !confirm('Slet dette lead?')) return;
    setDeleting(true);
    await fetch(`/api/crm/leads/${editingId}`, { method: 'DELETE' });
    setLeads(prev => prev.filter(l => l.id !== editingId));
    toast.success('Lead slettet');
    setDeleting(false);
    closeModal();
  };

  const visibleLeads = sellerFilter
    ? leads.filter(l => l.assigned_to === sellerFilter)
    : leads;

  const byStage = (key: StageKey) => visibleLeads.filter(l => l.status === key);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#94A3B8', fontSize: 14 }}>
      Indlæser CRM...
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid rgba(0,0,0,0.07)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, flexShrink: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1E293B' }}>Internt CRM</h1>
          <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>Pipeline for interne produktsalg</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isAdmin && users.length > 0 && (
            <select
              style={{ ...inputStyle, width: 170 }}
              value={sellerFilter}
              onChange={e => setSellerFilter(e.target.value)}
            >
              <option value="">Alle sælgere</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <button
            onClick={openNew}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#E84025', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            <Plus size={15} /> Nyt lead
          </button>
        </div>
      </div>

      {/* ── Kanban ── */}
      <div style={{ flex: 1, padding: '16px 16px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, height: '100%' }}>
          {STAGES.map(stage => {
            const stageLeads = byStage(stage.key);
            return (
              <div key={stage.key} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {/* Column header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '0 2px' }}>
                  <div style={{ width: 7, height: 7, borderRadius: 2, background: stage.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {stage.label}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: stage.color, background: stage.bg, borderRadius: 20, padding: '1px 6px', marginLeft: 'auto', flexShrink: 0 }}>
                    {stageLeads.length}
                  </span>
                </div>

                {/* Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, overflowY: 'auto', flex: 1, paddingBottom: 4 }}>
                  {stageLeads.map(lead => (
                    <div
                      key={lead.id}
                      onClick={() => openLead(lead)}
                      style={{ background: '#FFFFFF', borderRadius: 9, border: '1px solid rgba(0,0,0,0.07)', padding: '11px 12px', cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.1s' }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLDivElement;
                        el.style.boxShadow = '0 3px 14px rgba(0,0,0,0.1)';
                        el.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLDivElement;
                        el.style.boxShadow = 'none';
                        el.style.transform = 'none';
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                        {lead.company}
                      </div>
                      {lead.contact_name && (
                        <div style={{ fontSize: 10, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {lead.contact_name}
                        </div>
                      )}
                      {lead.deal_value > 0 && (
                        <div style={{ fontSize: 12, fontWeight: 700, color: stage.key === 'won' ? '#10B981' : '#1E293B', marginTop: 6 }}>
                          {fmtDKK(lead.deal_value)}
                        </div>
                      )}
                      {lead.product_name && (
                        <div style={{ marginTop: 6 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(232,64,37,0.1)', color: '#E84025', borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {lead.product_name}
                          </span>
                        </div>
                      )}
                      {isAdmin && lead.assigned_name && (
                        <div style={{ fontSize: 9, color: '#CBD5E1', marginTop: 5 }}>{lead.assigned_name}</div>
                      )}
                    </div>
                  ))}

                  {stageLeads.length === 0 && (
                    <div style={{ border: '1.5px dashed rgba(0,0,0,0.07)', borderRadius: 9, padding: '18px 0', textAlign: 'center', color: '#CBD5E1', fontSize: 11 }}>
                      Ingen leads
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Lead modal (centered popup) ── */}
      {modal !== null && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div style={{ background: '#FFFFFF', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}>

            {/* Modal header */}
            <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1E293B' }}>
                {editingId ? form.company || 'Rediger lead' : 'Nyt lead'}
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {editingId && (
                  <button
                    onClick={deleteLead}
                    disabled={deleting}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    <Trash2 size={12} /> Slet
                  </button>
                )}
                <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', padding: 4 }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>

              {/* Stage selector — prominent at top */}
              <div>
                <label style={{ fontSize: 11, color: '#64748B', fontWeight: 600, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stadie</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {STAGES.map(s => (
                    <button
                      key={s.key}
                      onClick={() => setForm(p => ({ ...p, status: s.key }))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '7px 13px', borderRadius: 8,
                        border: `1.5px solid ${form.status === s.key ? s.color : 'rgba(0,0,0,0.1)'}`,
                        background: form.status === s.key ? `${s.color}15` : '#F8FAFC',
                        color: form.status === s.key ? s.color : '#64748B',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.12s',
                      }}
                    >
                      {form.status === s.key && <ChevronRight size={11} />}
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} />

              {/* Firma */}
              <div>
                <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Firmanavn *</label>
                <input style={inputStyle} placeholder="Acme A/S" value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} autoFocus={modal === 'new'} />
              </div>

              {/* Kontakt */}
              <div>
                <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Kontaktperson</label>
                <input style={inputStyle} placeholder="Navn" value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Email</label>
                  <input style={inputStyle} type="email" placeholder="kontakt@firma.dk" value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Telefon</label>
                  <input style={inputStyle} placeholder="+45 ..." value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} />
                </div>
              </div>

              {/* Produkt + Værdi */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Produkt</label>
                  <select
                    style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                    value={form.product_id}
                    onChange={e => {
                      const pid = e.target.value;
                      const prod = products.find(p => p.id === pid);
                      setForm(prev => ({ ...prev, product_id: pid, deal_value: prod && prod.price > 0 ? String(prod.price) : prev.deal_value }));
                    }}
                  >
                    <option value="">— Vælg</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Værdi (DKK)</label>
                  <input style={inputStyle} type="number" placeholder="0" value={form.deal_value} onChange={e => setForm(p => ({ ...p, deal_value: e.target.value }))} />
                </div>
              </div>

              {/* Sælger (admin only) */}
              {isAdmin && users.length > 0 && (
                <div>
                  <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Tildelt sælger</label>
                  <select style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }} value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}>
                    <option value="">— Ingen</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              )}

              {/* Noter */}
              <div>
                <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Noter</label>
                <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder="Valgfrie noter..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(0,0,0,0.07)', display: 'flex', gap: 10, flexShrink: 0 }}>
              <button onClick={closeModal} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', background: '#F8FAFC', color: '#475569', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Annullér
              </button>
              <button
                onClick={save}
                disabled={saving || !form.company.trim()}
                style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: form.company.trim() && !saving ? '#E84025' : '#F1F5F9', color: form.company.trim() && !saving ? '#fff' : '#94A3B8', fontSize: 13, fontWeight: 600, cursor: form.company.trim() && !saving ? 'pointer' : 'not-allowed' }}
              >
                {saving ? 'Gemmer...' : editingId ? 'Gem ændringer' : 'Opret lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
