'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Pencil, Trash2 } from 'lucide-react';
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

function formatDKK(n: number) {
  return new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }).format(n);
}

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

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState(emptyForm);
  const [saving, setSaving]         = useState(false);

  const load = useCallback(async () => {
    const [leadsRes, productsRes, usersRes] = await Promise.all([
      fetch('/api/crm/leads').then(r => r.ok ? r.json() : []),
      fetch('/api/products').then(r => r.ok ? r.json() : []),
      isAdmin ? fetch('/api/users').then(r => r.ok ? r.json() : []) : Promise.resolve([]),
    ]);
    setLeads(Array.isArray(leadsRes) ? leadsRes : []);
    setProducts(Array.isArray(productsRes) ? productsRes.filter((p: Product) => p.type !== undefined) : []);
    setUsers(Array.isArray(usersRes) ? usersRes : []);
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm, assigned_to: user?.id || '' });
    setDrawerOpen(true);
  };

  const openEdit = (lead: CrmLead) => {
    setEditingId(lead.id);
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
    setDrawerOpen(true);
  };

  const save = async () => {
    if (!form.company.trim()) { toast.error('Firmanavn er påkrævet'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        deal_value:   Number(form.deal_value) || 0,
        product_id:   form.product_id   || null,
        contact_name: form.contact_name  || null,
        contact_email:form.contact_email || null,
        contact_phone:form.contact_phone || null,
        notes:        form.notes         || null,
        assigned_to:  form.assigned_to   || null,
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
      setDrawerOpen(false);
    } catch { toast.error('Noget gik galt'); }
    finally { setSaving(false); }
  };

  const deleteLead = async (id: string) => {
    if (!confirm('Slet dette lead?')) return;
    await fetch(`/api/crm/leads/${id}`, { method: 'DELETE' });
    setLeads(prev => prev.filter(l => l.id !== id));
    toast.success('Lead slettet');
  };

  const moveStage = async (lead: CrmLead, newStatus: StageKey) => {
    const res = await fetch(`/api/crm/leads/${lead.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const updated: CrmLead = await res.json();
      setLeads(prev => prev.map(l => l.id === lead.id ? updated : l));
    }
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
    <div style={{ minHeight: '100vh', background: '#F1F5F9' }}>

      {/* ── Header ── */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid rgba(0,0,0,0.07)', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1E293B' }}>Internt CRM</h1>
          <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>Pipeline for interne produktsalg</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {isAdmin && users.length > 0 && (
            <select
              style={{ ...inputStyle, width: 180 }}
              value={sellerFilter}
              onChange={e => setSellerFilter(e.target.value)}
            >
              <option value="">Alle sælgere</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <button
            onClick={openNew}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#E84025', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={15} /> Nyt lead
          </button>
        </div>
      </div>

      {/* ── Kanban ── */}
      <div style={{ padding: '20px 20px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 12, minWidth: 'max-content' }}>
          {STAGES.map(stage => {
            const stageLeads = byStage(stage.key);
            return (
              <div key={stage.key} style={{ width: 270, flexShrink: 0 }}>
                {/* Column header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '0 4px' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: stage.color }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stage.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: stage.color, background: stage.bg, borderRadius: 20, padding: '1px 8px', marginLeft: 'auto' }}>{stageLeads.length}</span>
                </div>

                {/* Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80 }}>
                  {stageLeads.map(lead => (
                    <div
                      key={lead.id}
                      style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid rgba(0,0,0,0.07)', padding: '13px 14px', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.company}</div>
                          {lead.contact_name && (
                            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.contact_name}</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                          <button
                            onClick={e => { e.stopPropagation(); openEdit(lead); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: 3, borderRadius: 4, display: 'flex' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#64748B'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#CBD5E1'; }}
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); deleteLead(lead.id); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: 3, borderRadius: 4, display: 'flex' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#EF4444'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#CBD5E1'; }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Product badge */}
                      {lead.product_name && (
                        <div style={{ marginTop: 8 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, background: 'rgba(232,64,37,0.1)', color: '#E84025', borderRadius: 5, padding: '2px 7px' }}>
                            {lead.product_name}
                          </span>
                        </div>
                      )}

                      {/* Assigned name (admin only) */}
                      {isAdmin && lead.assigned_name && (
                        <div style={{ marginTop: 8, fontSize: 10, color: '#94A3B8' }}>
                          {lead.assigned_name}
                        </div>
                      )}

                      {/* Move stage buttons */}
                      <div style={{ marginTop: 10, display: 'flex', gap: 4 }}>
                        {STAGES.filter(s => s.key !== stage.key && s.key !== 'lost').map(s => (
                          <button
                            key={s.key}
                            onClick={e => { e.stopPropagation(); moveStage(lead, s.key); }}
                            title={`Flyt til ${s.label}`}
                            style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, border: `1px solid ${s.color}40`, background: `${s.color}0D`, color: s.color, cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            → {s.label}
                          </button>
                        ))}
                        {stage.key !== 'lost' && (
                          <button
                            onClick={e => { e.stopPropagation(); moveStage(lead, 'lost'); }}
                            title="Flyt til Tabt"
                            style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: '#EF4444', cursor: 'pointer' }}
                          >
                            Tabt
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {stageLeads.length === 0 && (
                    <div style={{ border: '1.5px dashed rgba(0,0,0,0.08)', borderRadius: 10, padding: '20px 0', textAlign: 'center', color: '#CBD5E1', fontSize: 12 }}>
                      Ingen leads
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Drawer ── */}
      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex' }}>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} onClick={() => setDrawerOpen(false)} />
          <div style={{ width: 420, background: '#FFFFFF', boxShadow: '-8px 0 32px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1E293B' }}>{editingId ? 'Rediger lead' : 'Nyt lead'}</h3>
              <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
            </div>

            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 13, flex: 1 }}>
              <div>
                <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Firmanavn *</label>
                <input style={inputStyle} placeholder="Acme A/S" value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} autoFocus />
              </div>

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
                  <option value="">— Vælg produkt</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.price > 0 ? ` (${new Intl.NumberFormat('da-DK').format(p.price)} kr/${p.type === 'mrr' ? 'md.' : 'engang'})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Deal-værdi (DKK)</label>
                <input style={inputStyle} type="number" placeholder="0" value={form.deal_value} onChange={e => setForm(p => ({ ...p, deal_value: e.target.value }))} />
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Status</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {STAGES.map(s => (
                    <button
                      key={s.key}
                      onClick={() => setForm(p => ({ ...p, status: s.key }))}
                      style={{ padding: '6px 12px', borderRadius: 7, border: `1.5px solid ${form.status === s.key ? s.color : 'rgba(0,0,0,0.1)'}`, background: form.status === s.key ? `${s.color}15` : '#F8FAFC', color: form.status === s.key ? s.color : '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {isAdmin && users.length > 0 && (
                <div>
                  <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Tildelt sælger</label>
                  <select style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }} value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))}>
                    <option value="">— Ingen</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Noter</label>
                <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder="Valgfrie noter..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>

            <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(0,0,0,0.07)', display: 'flex', gap: 10, flexShrink: 0 }}>
              <button onClick={() => setDrawerOpen(false)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', background: '#F8FAFC', color: '#475569', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Annullér</button>
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
