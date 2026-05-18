'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, X, Pencil, Trash2, TrendingUp, DollarSign, BarChart2, Package, Check, ListChecks, Settings, UserPlus, UserMinus, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/lib/UserContext';

interface Deal {
  id: string; company_name: string; cvr: string | null;
  contact_name: string | null; contact_email: string | null; contact_phone: string | null;
  salesperson_id: string | null; salesperson_name: string | null;
  product_id: string | null; product_name: string | null;
  task_type_id: string | null; deal_value: number;
  type: 'sales' | 'booking'; status: 'won' | 'pending' | 'lost';
  notes: string | null; closed_at: string;
}
interface Product { id: string; name: string; description: string | null; price: number; currency: string; active: boolean; }
interface TaskType { id: string; name: string; client_id: string; }
interface User { id: string; name: string; }
interface Client {
  id: string; name: string; description: string | null;
  type: 'sales' | 'booking'; color: string; active: boolean;
  revenue_model: 'none' | 'fixed' | 'percentage';
  revenue_fixed: number; revenue_pct: number;
  assigned_sellers: { id: string; name: string }[];
}

function formatDKK(n: number) {
  return new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }).format(n);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

const inputStyle: React.CSSProperties = {
  background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 7, padding: '8px 11px', color: '#1E293B',
  fontSize: 13, width: '100%', outline: 'none', boxSizing: 'border-box',
};

const emptyDeal = {
  company_name: '', cvr: '', contact_name: '', contact_email: '',
  contact_phone: '', salesperson_id: '', product_id: '', task_type_id: '',
  deal_value: '', type: 'sales' as 'sales' | 'booking',
  status: 'won' as 'won' | 'pending' | 'lost',
  notes: '', closed_at: new Date().toISOString().slice(0, 10),
};

export default function SalesClientPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';

  const [client, setClient]       = useState<Client | null>(null);
  const [deals, setDeals]         = useState<Deal[]>([]);
  const [products, setProducts]   = useState<Product[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [users, setUsers]         = useState<User[]>([]);
  const [tab, setTab]             = useState<'deals' | 'products' | 'settings'>('deals');
  const [loading, setLoading]     = useState(true);

  // Deal form
  const [showDealForm, setShowDealForm] = useState(false);
  const [dealForm, setDealForm]         = useState(emptyDeal);
  const [savingDeal, setSavingDeal]     = useState(false);
  const [editingDeal, setEditingDeal]   = useState<string | null>(null);

  // Product form
  const [showProductForm, setShowProductForm] = useState(false);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '', currency: 'DKK' });
  const [savingProduct, setSavingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);

  // Task type form
  const [newTaskTypeName, setNewTaskTypeName] = useState('');
  const [savingTaskType, setSavingTaskType]   = useState(false);

  // Settings
  const [settings, setSettings] = useState({ revenue_model: 'none' as 'none' | 'fixed' | 'percentage', revenue_fixed: '', revenue_pct: '' });
  const [savingSettings, setSavingSettings] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  const load = useCallback(async () => {
    const [clientRes, dealsRes, productsRes, usersRes, ttRes] = await Promise.all([
      fetch(`/api/salg/clients/${id}`),
      fetch(`/api/salg/clients/${id}/deals`),
      fetch(`/api/salg/clients/${id}/products`),
      fetch('/api/users'),
      fetch(`/api/salg/clients/${id}/task-types`),
    ]);
    if (!clientRes.ok) { router.push('/salg'); return; }
    const c = await clientRes.json();
    setClient(c);
    setSettings({ revenue_model: c.revenue_model || 'none', revenue_fixed: c.revenue_fixed ? String(c.revenue_fixed) : '', revenue_pct: c.revenue_pct ? String(c.revenue_pct) : '' });
    setDeals(dealsRes.ok ? await dealsRes.json() : []);
    setProducts(productsRes.ok ? await productsRes.json() : []);
    setUsers(usersRes.ok ? await usersRes.json() : []);
    setTaskTypes(ttRes.ok ? await ttRes.json() : []);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  // ── Deal handlers ──────────────────────────────────────────────────────
  const openNewDeal = () => { setEditingDeal(null); setDealForm(emptyDeal); setShowDealForm(true); };
  const openEditDeal = (deal: Deal) => {
    setEditingDeal(deal.id);
    setDealForm({
      company_name: deal.company_name, cvr: deal.cvr || '',
      contact_name: deal.contact_name || '', contact_email: deal.contact_email || '',
      contact_phone: deal.contact_phone || '', salesperson_id: deal.salesperson_id || '',
      product_id: deal.product_id || '', task_type_id: deal.task_type_id || '',
      deal_value: String(deal.deal_value), type: deal.type, status: deal.status,
      notes: deal.notes || '', closed_at: deal.closed_at.slice(0, 10),
    });
    setShowDealForm(true);
  };

  const saveDeal = async () => {
    if (!dealForm.company_name.trim()) { toast.error('Firmanavn er påkrævet'); return; }
    setSavingDeal(true);
    try {
      const payload = {
        ...dealForm,
        deal_value: Number(dealForm.deal_value) || 0,
        salesperson_id: dealForm.salesperson_id || null,
        product_id:     dealForm.product_id || null,
        task_type_id:   dealForm.task_type_id || null,
        cvr:            dealForm.cvr || null,
        contact_name:   dealForm.contact_name || null,
        contact_email:  dealForm.contact_email || null,
        contact_phone:  dealForm.contact_phone || null,
        notes:          dealForm.notes || null,
      };
      const url = editingDeal ? `/api/salg/clients/${id}/deals/${editingDeal}` : `/api/salg/clients/${id}/deals`;
      const res = await fetch(url, { method: editingDeal ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      if (editingDeal) {
        setDeals(prev => prev.map(d => d.id === editingDeal ? saved : d));
        toast.success('Salg opdateret');
      } else {
        setDeals(prev => [saved, ...prev]);
        toast.success('Salg registreret');
      }
      setShowDealForm(false);
    } catch { toast.error('Noget gik galt'); }
    finally { setSavingDeal(false); }
  };

  const deleteDeal = async (dealId: string) => {
    if (!confirm('Slet dette salg?')) return;
    await fetch(`/api/salg/clients/${id}/deals/${dealId}`, { method: 'DELETE' });
    setDeals(prev => prev.filter(d => d.id !== dealId));
    toast.success('Salg slettet');
  };

  // ── Product handlers ───────────────────────────────────────────────────
  const openNewProduct = () => { setEditingProduct(null); setProductForm({ name: '', description: '', price: '', currency: 'DKK' }); setShowProductForm(true); };
  const openEditProduct = (p: Product) => {
    setEditingProduct(p.id);
    setProductForm({ name: p.name, description: p.description || '', price: String(p.price), currency: p.currency });
    setShowProductForm(true);
  };
  const saveProduct = async () => {
    if (!productForm.name.trim()) { toast.error('Navn er påkrævet'); return; }
    setSavingProduct(true);
    try {
      const payload = { ...productForm, price: Number(productForm.price) || 0 };
      const url = editingProduct ? `/api/salg/clients/${id}/products/${editingProduct}` : `/api/salg/clients/${id}/products`;
      const res = await fetch(url, { method: editingProduct ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      if (editingProduct) {
        setProducts(prev => prev.map(p => p.id === editingProduct ? saved : p));
        toast.success('Produkt opdateret');
      } else {
        setProducts(prev => [...prev, saved]);
        toast.success('Produkt oprettet');
      }
      setShowProductForm(false);
    } catch { toast.error('Noget gik galt'); }
    finally { setSavingProduct(false); }
  };
  const deleteProduct = async (productId: string) => {
    if (!confirm('Slet dette produkt?')) return;
    await fetch(`/api/salg/clients/${id}/products/${productId}`, { method: 'DELETE' });
    setProducts(prev => prev.filter(p => p.id !== productId));
    toast.success('Produkt slettet');
  };

  // ── Task type handlers ─────────────────────────────────────────────────
  const addTaskType = async () => {
    if (!newTaskTypeName.trim()) return;
    setSavingTaskType(true);
    try {
      const res = await fetch(`/api/salg/clients/${id}/task-types`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newTaskTypeName.trim() }) });
      if (!res.ok) throw new Error();
      const tt = await res.json();
      setTaskTypes(prev => [...prev, tt]);
      setNewTaskTypeName('');
      toast.success('Opgavetype oprettet');
    } catch { toast.error('Noget gik galt'); }
    finally { setSavingTaskType(false); }
  };
  const deleteTaskType = async (ttId: string) => {
    if (!confirm('Slet denne opgavetype?')) return;
    await fetch(`/api/salg/clients/${id}/task-types/${ttId}`, { method: 'DELETE' });
    setTaskTypes(prev => prev.filter(t => t.id !== ttId));
    toast.success('Opgavetype slettet');
  };

  // ── Settings handlers ──────────────────────────────────────────────────
  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/salg/clients/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revenue_model: settings.revenue_model,
          revenue_fixed: Number(settings.revenue_fixed) || 0,
          revenue_pct:   Number(settings.revenue_pct) || 0,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setClient(prev => prev ? { ...prev, ...updated } : prev);
      toast.success('Indstillinger gemt');
    } catch { toast.error('Noget gik galt'); }
    finally { setSavingSettings(false); }
  };

  const toggleActive = async () => {
    if (!client) return;
    setTogglingActive(true);
    try {
      const res = await fetch(`/api/salg/clients/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !client.active }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setClient(prev => prev ? { ...prev, active: updated.active } : prev);
      toast.success(updated.active ? 'Opgave aktiveret' : 'Opgave deaktiveret');
    } catch { toast.error('Noget gik galt'); }
    finally { setTogglingActive(false); }
  };

  const assignSeller = async (userId: string) => {
    await fetch(`/api/salg/clients/${id}/sellers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) });
    const u = users.find(x => x.id === userId);
    if (u) setClient(prev => prev ? { ...prev, assigned_sellers: [...(prev.assigned_sellers || []), u] } : prev);
    toast.success('Sælger tilføjet');
  };

  const removeSeller = async (userId: string) => {
    await fetch(`/api/salg/clients/${id}/sellers/${userId}`, { method: 'DELETE' });
    setClient(prev => prev ? { ...prev, assigned_sellers: (prev.assigned_sellers || []).filter(s => s.id !== userId) } : prev);
    toast.success('Sælger fjernet');
  };

  // ── Stats ──────────────────────────────────────────────────────────────
  const wonDeals     = deals.filter(d => d.status === 'won');
  const totalRevenue = wonDeals.reduce((s, d) => s + Number(d.deal_value), 0);
  const now          = new Date();
  const monthDeals   = wonDeals.filter(d => {
    const dd = new Date(d.closed_at);
    return dd.getFullYear() === now.getFullYear() && dd.getMonth() === now.getMonth();
  });
  const avgDeal = wonDeals.length ? Math.round(totalRevenue / wonDeals.length) : 0;

  if (loading) return <div style={{ padding: 32, color: '#94A3B8', fontSize: 13 }}>Indlæser...</div>;
  if (!client) return null;

  const assignedIds = new Set((client.assigned_sellers || []).map(s => s.id));
  const unassignedUsers = users.filter(u => !assignedIds.has(u.id));

  const tabs = [
    { key: 'deals'    as const, label: `Salg (${deals.length})`,         icon: <TrendingUp size={13} /> },
    { key: 'products' as const, label: `Produkter (${products.length})`, icon: <Package size={13} /> },
    ...(isAdmin ? [{ key: 'settings' as const, label: 'Indstillinger', icon: <Settings size={13} /> }] : []),
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9' }}>

      {/* ── Header ── */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid rgba(0,0,0,0.07)', padding: '0 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, height: 64 }}>
          <button onClick={() => router.push('/salg')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 8px', borderRadius: 6, fontSize: 13 }}>
            <ArrowLeft size={15} /> Salg
          </button>
          <span style={{ color: '#E2E8F0' }}>·</span>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: client.active ? client.color : '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>
            {client.name[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1E293B' }}>{client.name}</div>
            {client.description && <div style={{ fontSize: 12, color: '#94A3B8' }}>{client.description}</div>}
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '3px 8px', borderRadius: 5, background: client.type === 'booking' ? 'rgba(52,152,219,0.12)' : 'rgba(46,204,113,0.12)', color: client.type === 'booking' ? '#3498DB' : '#27AE60' }}>
            {client.type === 'booking' ? 'Mødebooking' : 'Salg'}
          </span>
          {!client.active && (
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '3px 8px', borderRadius: 5, background: 'rgba(148,163,184,0.15)', color: '#94A3B8' }}>
              Inaktiv
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: '28px 32px' }}>

        {/* ── Stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
          {[
            { label: 'Lukkede salg i alt', value: wonDeals.length,                                      icon: Check,       color: '#2ECC71' },
            { label: 'Denne måneds salg',  value: monthDeals.length,                                    icon: TrendingUp,  color: '#3498DB' },
            { label: 'Omsætning i alt',    value: isAdmin ? formatDKK(totalRevenue) : `${wonDeals.length} salg`, icon: DollarSign, color: '#E84025' },
            { label: 'Gns. deal-størrelse',value: isAdmin ? formatDKK(avgDeal) : '—',                   icon: BarChart2,   color: '#9B59B6' },
          ].map(stat => (
            <div key={stat.label} style={{ background: '#FFFFFF', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: `${stat.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <stat.icon size={16} color={stat.color} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1E293B', lineHeight: 1.2 }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(0,0,0,0.08)', marginBottom: 20 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: '10px 18px', border: 'none', background: 'transparent', fontSize: 13, fontWeight: tab === t.key ? 600 : 400, color: tab === t.key ? '#1E293B' : '#94A3B8', borderBottom: `2px solid ${tab === t.key ? '#E84025' : 'transparent'}`, cursor: 'pointer', marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6 }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── Deals tab ── */}
        {tab === 'deals' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
              <button onClick={openNewDeal} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#E84025', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <Plus size={14} /> Registrér salg
              </button>
            </div>
            {deals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', background: '#FFFFFF', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)' }}>
                <TrendingUp size={40} color="#CBD5E1" />
                <div style={{ color: '#94A3B8', marginTop: 12, fontSize: 14, fontWeight: 600 }}>Ingen salg registreret endnu</div>
                <div style={{ color: '#CBD5E1', fontSize: 12, marginTop: 4 }}>Klik &quot;Registrér salg&quot; for at tilføje det første</div>
              </div>
            ) : (
              <div style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Firma', 'CVR', 'Kontakt', 'Sælger', 'Produkt', 'Opgavetype', ...(isAdmin ? ['Værdi'] : []), 'Dato', ''].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {deals.map((deal, i) => {
                      const tt = taskTypes.find(t => t.id === deal.task_type_id);
                      return (
                        <tr key={deal.id} style={{ borderBottom: i < deals.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{deal.company_name}</div>
                            {deal.contact_email && <div style={{ fontSize: 11, color: '#94A3B8' }}>{deal.contact_email}</div>}
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: '#64748B' }}>{deal.cvr || '—'}</td>
                          <td style={{ padding: '12px 14px' }}>
                            {deal.contact_name
                              ? <><div style={{ fontSize: 12, color: '#475569' }}>{deal.contact_name}</div>{deal.contact_phone && <div style={{ fontSize: 11, color: '#94A3B8' }}>{deal.contact_phone}</div>}</>
                              : <span style={{ color: '#CBD5E1', fontSize: 12 }}>—</span>}
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: '#475569' }}>{deal.salesperson_name || '—'}</td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: '#475569' }}>{deal.product_name || '—'}</td>
                          <td style={{ padding: '12px 14px' }}>
                            {tt ? <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }}>{tt.name}</span>
                              : <span style={{ color: '#CBD5E1', fontSize: 12 }}>—</span>}
                          </td>
                          {isAdmin && (
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: deal.status === 'won' ? '#2ECC71' : deal.status === 'lost' ? '#E74C3C' : '#F39C12' }}>
                                {formatDKK(Number(deal.deal_value))}
                              </span>
                            </td>
                          )}
                          <td style={{ padding: '12px 14px', fontSize: 12, color: '#64748B', whiteSpace: 'nowrap' }}>{fmtDate(deal.closed_at)}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => openEditDeal(deal)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, borderRadius: 5 }}><Pencil size={13} /></button>
                              <button onClick={() => deleteDeal(deal.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, borderRadius: 5 }}><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Products tab ── */}
        {tab === 'products' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
              <button onClick={openNewProduct} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#E84025', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <Plus size={14} /> Nyt produkt
              </button>
            </div>
            {products.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', background: '#FFFFFF', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)' }}>
                <Package size={40} color="#CBD5E1" />
                <div style={{ color: '#94A3B8', marginTop: 12, fontSize: 14, fontWeight: 600 }}>Ingen produkter endnu</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {products.map(p => (
                  <div key={p.id} style={{ background: '#FFFFFF', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1E293B' }}>{p.name}</div>
                      {p.description && <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{p.description}</div>}
                    </div>
                    {isAdmin && p.price > 0 && <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B', minWidth: 100, textAlign: 'right' }}>{formatDKK(p.price)}</div>}
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEditProduct(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}><Pencil size={14} /></button>
                      <button onClick={() => deleteProduct(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Settings tab (admin only) ── */}
        {tab === 'settings' && isAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Active toggle */}
            <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1E293B' }}>Opgavestatus</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  {client.active ? 'Opgaven er aktiv — sælgere kan registrere salg' : 'Opgaven er inaktiv — vises ikke for sælgere'}
                </div>
              </div>
              <button
                onClick={toggleActive}
                disabled={togglingActive}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, border: 'none', background: client.active ? 'rgba(46,204,113,0.1)' : 'rgba(148,163,184,0.1)', color: client.active ? '#27AE60' : '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {client.active ? <ToggleRight size={18} color="#27AE60" /> : <ToggleLeft size={18} />}
                {client.active ? 'Aktiv' : 'Inaktiv'}
              </button>
            </div>

            {/* Revenue model */}
            <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', padding: '18px 22px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>Omsætningsmodel</div>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>Hvordan beregnes husets omsætning på denne opgave?</div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                {([
                  { key: 'none',       label: 'Ingen model',   desc: 'Salgsværdi = omsætning' },
                  { key: 'fixed',      label: 'Fast beløb',    desc: 'Fast DKK per salg/møde' },
                  { key: 'percentage', label: 'Procentdel',    desc: '% af salgsværdien' },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setSettings(p => ({ ...p, revenue_model: opt.key }))}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${settings.revenue_model === opt.key ? '#E84025' : 'rgba(0,0,0,0.1)'}`, background: settings.revenue_model === opt.key ? 'rgba(232,64,37,0.05)' : '#F8FAFC', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: settings.revenue_model === opt.key ? '#E84025' : '#1E293B' }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{opt.desc}</div>
                  </button>
                ))}
              </div>

              {settings.revenue_model === 'fixed' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Fast beløb per salg (DKK)</label>
                  <input style={{ ...inputStyle, width: 200 }} type="number" placeholder="f.eks. 1000" value={settings.revenue_fixed} onChange={e => setSettings(p => ({ ...p, revenue_fixed: e.target.value }))} />
                </div>
              )}
              {settings.revenue_model === 'percentage' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Procentdel af salgsværdi (%)</label>
                  <input style={{ ...inputStyle, width: 200 }} type="number" placeholder="f.eks. 70" min="0" max="100" value={settings.revenue_pct} onChange={e => setSettings(p => ({ ...p, revenue_pct: e.target.value }))} />
                </div>
              )}

              <button
                onClick={saveSettings}
                disabled={savingSettings}
                style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: '#E84025', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {savingSettings ? 'Gemmer...' : 'Gem omsætningsmodel'}
              </button>
            </div>

            {/* Seller assignment */}
            <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', padding: '18px 22px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>Sælgertildeling</div>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>
                {(client.assigned_sellers || []).length === 0
                  ? 'Alle sælgere kan se denne opgave. Tilføj specifikke sælgere for at begrænse adgangen.'
                  : 'Kun tildelte sælgere kan se og registrere salg på denne opgave.'}
              </div>

              {(client.assigned_sellers || []).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {(client.assigned_sellers || []).map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #E84025, #C4331B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>
                          {s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 13, color: '#1E293B', fontWeight: 500 }}>{s.name}</span>
                      </div>
                      <button onClick={() => removeSeller(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                        <UserMinus size={13} /> Fjern
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {unassignedUsers.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>Tilføj sælger</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {unassignedUsers.map(u => (
                      <button
                        key={u.id}
                        onClick={() => assignSeller(u.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(0,0,0,0.1)', background: '#F8FAFC', color: '#475569', fontSize: 12, cursor: 'pointer' }}
                      >
                        <UserPlus size={11} /> {u.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Task types */}
            <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', padding: '18px 22px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>Opgavetyper</div>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 14 }}>Felter sælgerne vælger imellem ved registrering</div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="f.eks. Mødebooking, Koldt kanvas, Demo..."
                  value={newTaskTypeName}
                  onChange={e => setNewTaskTypeName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addTaskType(); }}
                />
                <button
                  onClick={addTaskType}
                  disabled={savingTaskType || !newTaskTypeName.trim()}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 7, border: 'none', background: newTaskTypeName.trim() && !savingTaskType ? '#E84025' : '#F1F5F9', color: newTaskTypeName.trim() && !savingTaskType ? '#fff' : '#94A3B8', fontSize: 13, fontWeight: 600, cursor: newTaskTypeName.trim() && !savingTaskType ? 'pointer' : 'not-allowed' }}
                >
                  <Plus size={14} /> Tilføj
                </button>
              </div>

              {taskTypes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {taskTypes.map(tt => (
                    <div key={tt.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ListChecks size={13} color="#3B82F6" />
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#1E293B' }}>{tt.name}</span>
                      </div>
                      <button onClick={() => deleteTaskType(tt.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* ── Deal form drawer ── */}
      {showDealForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex' }} onClick={e => { if (e.target === e.currentTarget) setShowDealForm(false); }}>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} onClick={() => setShowDealForm(false)} />
          <div style={{ width: 420, background: '#FFFFFF', boxShadow: '-8px 0 32px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1E293B' }}>{editingDeal ? 'Rediger salg' : 'Registrér salg'}</h3>
              <button onClick={() => setShowDealForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
              <div>
                <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Firmanavn *</label>
                <input style={inputStyle} placeholder="Acme A/S" value={dealForm.company_name} onChange={e => setDealForm(p => ({ ...p, company_name: e.target.value }))} autoFocus />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>CVR</label>
                  <input style={inputStyle} placeholder="12345678" value={dealForm.cvr} onChange={e => setDealForm(p => ({ ...p, cvr: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Dato</label>
                  <input style={inputStyle} type="date" value={dealForm.closed_at} onChange={e => setDealForm(p => ({ ...p, closed_at: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Kontaktperson</label>
                <input style={inputStyle} placeholder="Navn" value={dealForm.contact_name} onChange={e => setDealForm(p => ({ ...p, contact_name: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Email</label>
                  <input style={inputStyle} type="email" placeholder="kontakt@firma.dk" value={dealForm.contact_email} onChange={e => setDealForm(p => ({ ...p, contact_email: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Telefon</label>
                  <input style={inputStyle} placeholder="+45 ..." value={dealForm.contact_phone} onChange={e => setDealForm(p => ({ ...p, contact_phone: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Sælger</label>
                  <select style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }} value={dealForm.salesperson_id} onChange={e => setDealForm(p => ({ ...p, salesperson_id: e.target.value }))}>
                    <option value="">— Vælg sælger</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Produkt</label>
                  <select
                    style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                    value={dealForm.product_id}
                    onChange={e => {
                      const pid = e.target.value;
                      const prod = products.find(p => p.id === pid);
                      setDealForm(prev => ({ ...prev, product_id: pid, deal_value: prod && prod.price > 0 ? String(prod.price) : prev.deal_value }));
                    }}
                  >
                    <option value="">— Vælg produkt</option>
                    {products.filter(p => p.active).map(p => (
                      <option key={p.id} value={p.id}>{p.name}{p.price > 0 ? ` (${formatDKK(p.price)})` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>
              {taskTypes.length > 0 && (
                <div>
                  <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Opgavetype</label>
                  <select style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }} value={dealForm.task_type_id} onChange={e => setDealForm(p => ({ ...p, task_type_id: e.target.value }))}>
                    <option value="">— Vælg opgavetype</option>
                    {taskTypes.map(tt => <option key={tt.id} value={tt.id}>{tt.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>
                  Pris (DKK) <span style={{ color: '#CBD5E1', fontWeight: 400 }}>— variabel, kan ændres</span>
                </label>
                <input style={inputStyle} type="number" placeholder="0" value={dealForm.deal_value} onChange={e => setDealForm(p => ({ ...p, deal_value: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Status</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([['won', 'Vundet', '#2ECC71'], ['pending', 'Afventer', '#F39C12'], ['lost', 'Tabt', '#E74C3C']] as const).map(([val, label, color]) => (
                    <button key={val} onClick={() => setDealForm(p => ({ ...p, status: val }))}
                      style={{ flex: 1, padding: '7px 0', borderRadius: 7, border: `1.5px solid ${dealForm.status === val ? color : 'rgba(0,0,0,0.1)'}`, background: dealForm.status === val ? `${color}18` : '#F8FAFC', color: dealForm.status === val ? color : '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Noter</label>
                <textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} placeholder="Valgfrie noter..." value={dealForm.notes} onChange={e => setDealForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(0,0,0,0.07)', display: 'flex', gap: 10, flexShrink: 0 }}>
              <button onClick={() => setShowDealForm(false)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', background: '#F8FAFC', color: '#475569', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Annullér</button>
              <button onClick={saveDeal} disabled={savingDeal || !dealForm.company_name.trim()}
                style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: dealForm.company_name.trim() && !savingDeal ? '#E84025' : '#F1F5F9', color: dealForm.company_name.trim() && !savingDeal ? '#fff' : '#94A3B8', fontSize: 13, fontWeight: 600, cursor: dealForm.company_name.trim() && !savingDeal ? 'pointer' : 'not-allowed' }}>
                {savingDeal ? 'Gemmer...' : editingDeal ? 'Gem ændringer' : 'Registrér salg'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Product form modal ── */}
      {showProductForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { if (e.target === e.currentTarget) setShowProductForm(false); }}>
          <div style={{ background: '#FFFFFF', borderRadius: 14, padding: 28, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1E293B' }}>{editingProduct ? 'Rediger produkt' : 'Nyt produkt'}</h3>
              <button onClick={() => setShowProductForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={17} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Produktnavn *</label>
                <input style={inputStyle} placeholder="f.eks. Mødebooking pakke" value={productForm.name} onChange={e => setProductForm(p => ({ ...p, name: e.target.value }))} autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>Beskrivelse</label>
                <input style={inputStyle} placeholder="Kort beskrivelse" value={productForm.description} onChange={e => setProductForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#64748B', fontWeight: 500, display: 'block', marginBottom: 5 }}>
                  Vejledende pris (DKK) <span style={{ color: '#CBD5E1', fontWeight: 400 }}>— valgfrit</span>
                </label>
                <input style={inputStyle} type="number" placeholder="0 = variabel pris" value={productForm.price} onChange={e => setProductForm(p => ({ ...p, price: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowProductForm(false)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', background: '#F8FAFC', color: '#475569', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Annullér</button>
              <button onClick={saveProduct} disabled={savingProduct || !productForm.name.trim()}
                style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: productForm.name.trim() && !savingProduct ? '#E84025' : '#F1F5F9', color: productForm.name.trim() && !savingProduct ? '#fff' : '#94A3B8', fontSize: 13, fontWeight: 600, cursor: productForm.name.trim() && !savingProduct ? 'pointer' : 'not-allowed' }}>
                {savingProduct ? 'Gemmer...' : editingProduct ? 'Gem' : 'Opret produkt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
