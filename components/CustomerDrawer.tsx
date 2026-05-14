'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X, Mail, Phone, Edit3, Calendar, FileText, ShoppingBag,
  TrendingUp, AlertTriangle, CheckCircle, Clock, ExternalLink, Trash2,
  Globe, Eye, EyeOff, Copy, Check, Users, Plus, Minus, PowerOff, Power, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';

interface Customer {
  id: string;
  company: string;
  contact_name: string;
  contact_title: string;
  contact_email: string;
  contact_phone: string;
  market: string;
  mrr: number;
  contract_start: string;
  contract_end: string;
  churn_risk: 'low' | 'medium' | 'high';
  health_score: number;
  segment: string;
  notes: string;
  updated_at: string;
  active: boolean;
  assigned_to?: string;
  assigned_user_name?: string;
  assigned_user_email?: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  default_price?: number;
  default_type?: 'mrr' | 'onetime';
  type: 'mrr' | 'onetime';
  effective_price?: number;
  effective_type?: 'mrr' | 'onetime';
  custom_price?: number | null;
  custom_type?: string | null;
  currency: string;
  active: number;
}

interface Note {
  id: string;
  content: string;
  created_by: string;
  created_at: string;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'Lige nu';
  if (mins < 60) return `${mins}m siden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}t siden`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d siden`;
  return new Date(dateStr).toLocaleDateString('da-DK');
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(dateStr: string): number {
  if (!dateStr) return 999;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function ChurnBadge({ risk }: { risk: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    low: { label: 'Lav risiko', color: '#2ECC71', bg: 'rgba(46,204,113,0.12)' },
    medium: { label: 'Medium risiko', color: '#F39C12', bg: 'rgba(243,156,18,0.12)' },
    high: { label: 'Høj risiko', color: '#E74C3C', bg: 'rgba(231,76,60,0.12)' },
  };
  const s = map[risk] ?? map.low;
  return (
    <span style={{ fontSize: '11px', fontWeight: 600, color: s.color, background: s.bg, borderRadius: '4px', padding: '3px 8px' }}>
      {s.label}
    </span>
  );
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 80 ? '#2ECC71' : score >= 50 ? '#F39C12' : '#E74C3C';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '6px', background: 'rgba(0,0,0,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: '12px', fontWeight: 600, color, minWidth: '32px', textAlign: 'right' }}>{score}</span>
    </div>
  );
}

const MARKETS: Record<string, string> = { sweden: '🇸🇪 Sverige', denmark: '🇩🇰 Danmark' };
const SEGMENTS = ['smb', 'mid-market', 'enterprise'];
const CHURN_RISKS = ['low', 'medium', 'high'];

const inputStyle: React.CSSProperties = {
  background: '#F1F5F9', border: '1px solid rgba(0,0,0,0.08)',
  borderRadius: '6px', padding: '7px 10px', color: '#1E293B',
  fontSize: '12px', width: '100%', outline: 'none', boxSizing: 'border-box',
  marginBottom: '8px',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none',
  WebkitAppearance: 'none',
};

export default function CustomerDrawer({ customer, onClose, onUpdate, onDelete }: {
  customer: Customer;
  onClose: () => void;
  onUpdate: (id: string, changes: Partial<Customer>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<'Overblik' | 'Produkter' | 'Noter' | 'Portal' | 'Medlemmer'>('Overblik');
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Customer>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [customerProducts, setCustomerProducts] = useState<Product[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState('');

  // Portal state
  const [portalEnabled,  setPortalEnabled]  = useState(false);
  const [portalEmail,    setPortalEmail]    = useState('');
  const [portalPassword, setPortalPassword] = useState('');
  const [showPortalPw,   setShowPortalPw]   = useState(false);
  const [portalSaving,   setPortalSaving]   = useState(false);
  const [portalCopied,   setPortalCopied]   = useState(false);

  // Members state
  const [members,    setMembers]    = useState<{id: string; name: string; email: string; role: string}[]>([]);
  const [allUsers,   setAllUsers]   = useState<{id: string; name: string; role: string}[]>([]);
  const [memberSaving, setMemberSaving] = useState<string | null>(null);

  // Price override editing state
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [typeInput, setTypeInput] = useState<'mrr' | 'onetime'>('mrr');
  const [priceSaving, setPriceSaving] = useState(false);

  const loadProducts = useCallback(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(data => setAllProducts(Array.isArray(data) ? data.filter((p: Product) => p.active) : []))
      .catch(() => {});
    fetch(`/api/customers/${customer.id}/products`)
      .then(r => r.json())
      .then(data => setCustomerProducts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [customer.id]);

  const loadNotes = useCallback(() => {
    fetch(`/api/customers/${customer.id}/notes`)
      .then(r => r.json())
      .then(data => setNotes(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [customer.id]);

  const loadPortal = useCallback(() => {
    fetch(`/api/portal/setup?customer_id=${customer.id}`)
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) {
          setPortalEnabled(!!data.portal_enabled);
          setPortalEmail(data.portal_email || customer.contact_email || '');
        }
      })
      .catch(() => {});
  }, [customer.id]);

  const loadMembers = useCallback(() => {
    fetch(`/api/customers/${customer.id}/members`)
      .then(r => r.json())
      .then(data => setMembers(Array.isArray(data) ? data : []))
      .catch(() => {});
    fetch('/api/users')
      .then(r => r.json())
      .then(data => setAllUsers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [customer.id]);

  useEffect(() => {
    loadProducts();
    loadNotes();
    loadPortal();
    loadMembers();
  }, [loadProducts, loadNotes, loadPortal, loadMembers]);

  const toggleProduct = async (product: Product) => {
    const isSelected = customerProducts.some(p => p.id === product.id);
    try {
      const res = await fetch(`/api/customers/${customer.id}/products`, {
        method: isSelected ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id }),
      });
      const updated = await res.json();
      setCustomerProducts(Array.isArray(updated) ? updated : []);
      toast.success(isSelected ? 'Produkt fjernet' : 'Produkt tilføjet');
    } catch {
      toast.error('Fejl ved opdatering af produkt');
    }
  };

  const handleSave = async () => {
    await onUpdate(customer.id, editData);
    setEditing(false);
    toast.success('Kunde opdateret');
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    try {
      const res = await fetch(`/api/customers/${customer.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteText }),
      });
      const updated = await res.json();
      setNotes(Array.isArray(updated) ? updated : []);
      setNoteText('');
      toast.success('Note tilføjet');
    } catch {
      toast.error('Fejl ved tilføjelse af note');
    }
  };

  const openPriceEdit = (p: Product) => {
    setEditingProductId(p.id);
    setPriceInput(String(p.effective_price ?? p.price));
    setTypeInput((p.effective_type ?? p.type) as 'mrr' | 'onetime');
  };

  const savePrice = async (productId: string) => {
    setPriceSaving(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}/products`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, custom_price: Number(priceInput) || null, custom_type: typeInput }),
      });
      if (res.ok) {
        setCustomerProducts(await res.json());
        setEditingProductId(null);
        toast.success('Pris opdateret');
      }
    } finally { setPriceSaving(false); }
  };

  const resetPrice = async (productId: string) => {
    const res = await fetch(`/api/customers/${customer.id}/products`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, custom_price: null, custom_type: null }),
    });
    if (res.ok) {
      setCustomerProducts(await res.json());
      setEditingProductId(null);
      toast.success('Nulstillet til standardpris');
    }
  };

  const renewDays = daysUntil(customer.contract_end);
  const mrrProducts = customerProducts.filter(p => (p.effective_type ?? p.type) === 'mrr');
  const onetimeProducts = customerProducts.filter(p => (p.effective_type ?? p.type) === 'onetime');
  const totalMrr = mrrProducts.reduce((s, p) => s + (p.effective_price ?? p.price), 0);
  const totalOnetime = onetimeProducts.reduce((s, p) => s + (p.effective_price ?? p.price), 0);
  const upsellProducts = allProducts.filter(p => !customerProducts.some(cp => cp.id === p.id));

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 201,
        width: '500px', background: '#F1F5F9',
        borderLeft: '1px solid rgba(0,0,0,0.08)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1E293B' }}>{customer.company}</h2>
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>{MARKETS[customer.market] ?? customer.market}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <ChurnBadge risk={customer.churn_risk} />
                {renewDays < 90 && renewDays > 0 && (
                  <span style={{ fontSize: '11px', color: '#F39C12', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Clock size={11} /> Fornyes om {renewDays}d
                  </span>
                )}
                {renewDays <= 0 && (
                  <span style={{ fontSize: '11px', color: '#E74C3C', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <AlertTriangle size={11} /> Kontrakt udløbet
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '4px', flexShrink: 0 }}>
              <X size={18} />
            </button>
          </div>

          {/* KPI strip */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <div style={{ flex: 1, background: '#FFFFFF', borderRadius: '6px', padding: '8px 10px' }}>
              <div style={{ fontSize: '10px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '3px' }}>
                <TrendingUp size={11} /> MRR
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#2ECC71' }}>
                {totalMrr > 0 ? `${totalMrr.toLocaleString('da-DK')} DKK` : '—'}
              </div>
              {totalMrr > 0 && <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '1px' }}>{(totalMrr * 12).toLocaleString('da-DK')} DKK/år</div>}
            </div>
            {totalOnetime > 0 && (
              <div style={{ flex: 1, background: '#FFFFFF', borderRadius: '6px', padding: '8px 10px' }}>
                <div style={{ fontSize: '10px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '3px' }}>
                  <TrendingUp size={11} /> Engangs
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#F39C12' }}>
                  {totalOnetime.toLocaleString('da-DK')} DKK
                </div>
              </div>
            )}
            <div style={{ flex: 1, background: '#FFFFFF', borderRadius: '6px', padding: '8px 10px' }}>
              <div style={{ fontSize: '10px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '3px' }}>
                <CheckCircle size={11} /> Health
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: customer.health_score >= 70 ? '#2ECC71' : customer.health_score >= 40 ? '#F39C12' : '#E74C3C' }}>
                {customer.health_score ?? 0}/100
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => { setEditing(!editing); if (!editing) setEditData({ ...customer }); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: '6px', padding: '6px 12px', color: '#1E293B', fontSize: '12px', cursor: 'pointer',
              }}
            >
              <Edit3 size={12} /> {editing ? 'Annuller' : 'Rediger'}
            </button>
            <button
              onClick={async () => {
                await onUpdate(customer.id, { active: !customer.active } as Partial<Customer>);
                toast.success(customer.active ? `${customer.company} markeret som inaktiv` : `${customer.company} markeret som aktiv`);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                background: customer.active ? 'rgba(0,0,0,0.04)' : 'rgba(46,204,113,0.1)',
                border: customer.active ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(46,204,113,0.25)',
                borderRadius: '6px', padding: '6px 12px',
                color: customer.active ? '#94A3B8' : '#2ECC71',
                fontSize: '12px', cursor: 'pointer',
              }}
            >
              {customer.active ? <><PowerOff size={12} /> Deaktiver</> : <><Power size={12} /> Aktiver</>}
            </button>
            {onDelete && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.2)',
                  borderRadius: '6px', padding: '6px 12px', color: '#E74C3C', fontSize: '12px', cursor: 'pointer',
                }}
              >
                <Trash2 size={12} /> Slet
              </button>
            )}
            {onDelete && confirmDelete && (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#E74C3C' }}>Er du sikker?</span>
                <button
                  onClick={async () => {
                    await onDelete(customer.id);
                    toast.success(`${customer.company} slettet`);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    background: '#E74C3C', border: 'none',
                    borderRadius: '6px', padding: '6px 12px', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <Trash2 size={12} /> Ja, slet
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.08)',
                    borderRadius: '6px', padding: '6px 12px', color: '#1E293B', fontSize: '12px', cursor: 'pointer',
                  }}
                >
                  Annuller
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
          {(['Overblik', 'Produkter', 'Noter', 'Medlemmer', 'Portal'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '10px', border: 'none', background: 'transparent',
              color: tab === t ? '#1E293B' : '#94A3B8',
              borderBottom: `2px solid ${tab === t ? '#185FA5' : 'transparent'}`,
              fontSize: '12px', fontWeight: tab === t ? 600 : 400, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
              {t === 'Portal' && <Globe size={11} />}
              {t === 'Medlemmer' && <Users size={11} />}
              {t}
              {t === 'Portal' && portalEnabled && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2ECC71', display: 'inline-block' }} />
              )}
              {t === 'Medlemmer' && members.length > 0 && (
                <span style={{ fontSize: 9, background: 'rgba(0,0,0,0.08)', borderRadius: 8, padding: '1px 5px', color: '#475569' }}>{members.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* ===== OVERBLIK ===== */}
          {tab === 'Overblik' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Health score */}
              <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                  Sundhedsscore
                </div>
                <HealthBar score={customer.health_score ?? 0} />
                {customer.churn_risk === 'high' && (
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#E74C3C' }}>
                    <AlertTriangle size={12} />
                    Høj churr-risiko — handling påkrævet
                  </div>
                )}
              </div>

              {/* Contact */}
              <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Kontaktperson</div>
                {editing ? (
                  <>
                    <input placeholder="Navn" value={editData.contact_name || ''} onChange={e => setEditData(p => ({ ...p, contact_name: e.target.value }))} style={inputStyle} />
                    <input placeholder="Titel" value={editData.contact_title || ''} onChange={e => setEditData(p => ({ ...p, contact_title: e.target.value }))} style={inputStyle} />
                    <input placeholder="Email" value={editData.contact_email || ''} onChange={e => setEditData(p => ({ ...p, contact_email: e.target.value }))} style={inputStyle} />
                    <input placeholder="Telefon" value={editData.contact_phone || ''} onChange={e => setEditData(p => ({ ...p, contact_phone: e.target.value }))} style={{ ...inputStyle, marginBottom: 0 }} />
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B' }}>{customer.contact_name || '—'}</div>
                    {customer.contact_title && <div style={{ fontSize: '12px', color: '#94A3B8' }}>{customer.contact_title}</div>}
                    {customer.contact_email && (
                      <a href={`mailto:${customer.contact_email}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#185FA5', fontSize: '12px', textDecoration: 'none' }}>
                        <Mail size={12} /> {customer.contact_email}
                      </a>
                    )}
                    {customer.contact_phone && (
                      <a href={`tel:${customer.contact_phone}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94A3B8', fontSize: '12px', textDecoration: 'none' }}>
                        <Phone size={12} /> {customer.contact_phone}
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Lead */}
              <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Ansvarlig (Lead)</div>
                {editing ? (
                  <select
                    value={editData.assigned_to || ''}
                    onChange={e => setEditData(p => ({ ...p, assigned_to: e.target.value || undefined }))}
                    style={{ ...inputStyle, marginBottom: 0 }}
                  >
                    <option value="">— Ingen —</option>
                    {allUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role === 'admin' ? 'Admin' : 'Bruger'})</option>
                    ))}
                  </select>
                ) : customer.assigned_user_name ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(232,64,37,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#E84025', flexShrink: 0 }}>
                      {customer.assigned_user_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>{customer.assigned_user_name}</div>
                      {customer.assigned_user_email && (
                        <a href={`mailto:${customer.assigned_user_email}`} style={{ fontSize: '11px', color: '#94A3B8', textDecoration: 'none' }}>{customer.assigned_user_email}</a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#94A3B8' }}>Ingen ansvarlig valgt</div>
                )}
              </div>

              {/* Contract */}
              <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Kontrakt</div>
                {editing ? (
                  <>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>Startdato</div>
                    <input type="date" value={editData.contract_start || ''} onChange={e => setEditData(p => ({ ...p, contract_start: e.target.value }))} style={inputStyle} />
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>Slutdato</div>
                    <input type="date" value={editData.contract_end || ''} onChange={e => setEditData(p => ({ ...p, contract_end: e.target.value }))} style={inputStyle} />
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>Churn-risiko</div>
                    <select value={editData.churn_risk || 'low'} onChange={e => setEditData(p => ({ ...p, churn_risk: e.target.value as 'low' | 'medium' | 'high' }))} style={selectStyle}>
                      {CHURN_RISKS.map(r => <option key={r} value={r}>{r === 'low' ? 'Lav' : r === 'medium' ? 'Medium' : 'Høj'}</option>)}
                    </select>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>Health score (0-100)</div>
                    <input type="number" min={0} max={100} value={editData.health_score ?? ''} onChange={e => setEditData(p => ({ ...p, health_score: Number(e.target.value) }))} style={inputStyle} />
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>Segment</div>
                    <select value={editData.segment || 'smb'} onChange={e => setEditData(p => ({ ...p, segment: e.target.value }))} style={{ ...selectStyle, marginBottom: 0 }}>
                      {SEGMENTS.map(s => <option key={s} value={s}>{s === 'smb' ? 'SMB' : s === 'mid-market' ? 'Mid-Market' : 'Enterprise'}</option>)}
                    </select>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={11} /> Start</span>
                      <span style={{ fontSize: '12px', color: '#1E293B' }}>{formatDate(customer.contract_start)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={11} /> Udløber</span>
                      <span style={{ fontSize: '12px', color: renewDays < 60 ? '#F39C12' : '#1E293B' }}>
                        {formatDate(customer.contract_end)}
                        {renewDays > 0 && renewDays < 365 && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#94A3B8' }}>({renewDays}d)</span>}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#94A3B8' }}>Segment</span>
                      <span style={{ fontSize: '12px', color: '#1E293B', textTransform: 'capitalize' }}>
                        {customer.segment === 'smb' ? 'SMB' : customer.segment === 'mid-market' ? 'Mid-Market' : customer.segment}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Internal notes */}
              <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Interne noter</div>
                {editing ? (
                  <textarea
                    value={editData.notes || ''}
                    onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Interne noter om kunden..."
                    style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', marginBottom: 0 }}
                  />
                ) : (
                  <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: 1.6 }}>
                    {customer.notes || <span style={{ color: '#94A3B8' }}>Ingen noter endnu</span>}
                  </p>
                )}
              </div>

              {editing && (
                <button onClick={handleSave} style={{ background: '#185FA5', border: 'none', borderRadius: '6px', padding: '10px', color: '#1E293B', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>
                  Gem ændringer
                </button>
              )}
            </div>
          )}

          {/* ===== PRODUKTER ===== */}
          {tab === 'Produkter' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Active products */}
              <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShoppingBag size={12} /> Aktive produkter
                </div>
                {allProducts.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#94A3B8', textAlign: 'center', padding: '20px 0' }}>Ingen produkter oprettet endnu</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {allProducts.map(product => {
                      const active = customerProducts.find(p => p.id === product.id);
                      const isEditing = editingProductId === product.id;
                      const effPrice = active ? (active.effective_price ?? active.price) : product.price;
                      const effType  = active ? (active.effective_type  ?? active.type)  : product.type;
                      const isOverridden = active && (active.custom_price != null || active.custom_type != null);
                      return (
                        <div key={product.id} style={{ borderRadius: '6px', overflow: 'hidden', border: `1px solid ${active ? 'rgba(24,95,165,0.5)' : 'rgba(0,0,0,0.08)'}` }}>
                          {/* Row */}
                          <div
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '8px 10px', cursor: 'pointer', textAlign: 'left',
                              background: active ? 'rgba(24,95,165,0.12)' : 'rgba(0,0,0,0.03)',
                            }}
                            onClick={() => { if (!isEditing) toggleProduct(product); }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{
                                width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                                background: active ? '#185FA5' : 'rgba(0,0,0,0.08)',
                                border: `1px solid ${active ? '#185FA5' : 'rgba(0,0,0,0.12)'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {active && <span style={{ color: '#fff', fontSize: '10px' }}>✓</span>}
                              </div>
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: 500, color: active ? '#1E293B' : '#475569' }}>{product.name}</div>
                                {product.description && <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '1px' }}>{product.description}</div>}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '8px' }}>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: isOverridden ? '#F39C12' : (active ? '#185FA5' : '#94A3B8') }}>
                                  {effPrice.toLocaleString('da-DK')} {product.currency}
                                </span>
                                <span style={{ fontSize: '10px', color: '#94A3B8', display: 'block' }}>
                                  {effType === 'mrr' ? '/md' : 'engangsbetaling'}
                                  {isOverridden && <span style={{ color: '#F39C12' }}> *</span>}
                                </span>
                              </div>
                              {active && (
                                <button
                                  onClick={e => { e.stopPropagation(); if (isEditing) { setEditingProductId(null); } else { openPriceEdit(active); } }}
                                  title="Tilpas pris"
                                  style={{ background: isEditing ? 'rgba(243,156,18,0.2)' : 'rgba(0,0,0,0.06)', border: `1px solid ${isEditing ? 'rgba(243,156,18,0.4)' : 'rgba(0,0,0,0.08)'}`, borderRadius: '4px', padding: '3px 6px', cursor: 'pointer', color: isEditing ? '#F39C12' : '#94A3B8', fontSize: '11px' }}
                                >
                                  <Pencil size={10} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Inline price editor */}
                          {isEditing && (
                            <div style={{ padding: '10px 12px', background: 'rgba(243,156,18,0.06)', borderTop: '1px solid rgba(243,156,18,0.15)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ fontSize: '10px', color: '#F39C12', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tilpas pris for denne kunde</div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                  type="number"
                                  value={priceInput}
                                  onChange={e => setPriceInput(e.target.value)}
                                  style={{ ...inputStyle, width: '100px', marginBottom: 0 }}
                                  placeholder="Pris"
                                />
                                <span style={{ fontSize: '11px', color: '#94A3B8' }}>{product.currency}</span>
                                <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
                                  {(['mrr', 'onetime'] as const).map(t => (
                                    <button
                                      key={t}
                                      onClick={() => setTypeInput(t)}
                                      style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', border: `1px solid ${typeInput === t ? 'rgba(243,156,18,0.5)' : 'rgba(0,0,0,0.08)'}`, background: typeInput === t ? 'rgba(243,156,18,0.15)' : 'transparent', color: typeInput === t ? '#F39C12' : '#94A3B8', cursor: 'pointer' }}
                                    >
                                      {t === 'mrr' ? 'MRR' : 'Engangsbetaling'}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <button onClick={() => savePrice(product.id)} disabled={priceSaving} style={{ fontSize: '11px', padding: '5px 12px', borderRadius: '5px', border: 'none', background: '#F39C12', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                                  {priceSaving ? 'Gemmer...' : 'Gem'}
                                </button>
                                <button onClick={() => setEditingProductId(null)} style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.08)', background: 'transparent', color: '#94A3B8', cursor: 'pointer' }}>
                                  Annuller
                                </button>
                                {isOverridden && (
                                  <button onClick={() => resetPrice(product.id)} style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.08)', background: 'transparent', color: '#94A3B8', cursor: 'pointer', marginLeft: 'auto' }}>
                                    Nulstil til standard ({(product.price).toLocaleString('da-DK')} {product.currency})
                                  </button>
                                )}
                              </div>
                              <div style={{ fontSize: '10px', color: '#94A3B8' }}>
                                Standardpris: {product.price.toLocaleString('da-DK')} {product.currency}{product.type === 'mrr' ? '/md' : ' engangsbetaling'}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {customerProducts.length > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {totalMrr > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#94A3B8' }}>MRR (månedlig betaling)</span>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#2ECC71' }}>{totalMrr.toLocaleString('da-DK')} DKK/md</span>
                          <span style={{ fontSize: '10px', color: '#94A3B8', display: 'block' }}>{(totalMrr * 12).toLocaleString('da-DK')} DKK/år</span>
                        </div>
                      </div>
                    )}
                    {totalOnetime > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#94A3B8' }}>Engangsbetalinger</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#F39C12' }}>{totalOnetime.toLocaleString('da-DK')} DKK</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Upsell opportunities */}
              {upsellProducts.length > 0 && (
                <div style={{ background: 'rgba(24,95,165,0.06)', border: '1px solid rgba(24,95,165,0.2)', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: '#185FA5', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <ExternalLink size={11} /> Upsell muligheder
                  </div>
                  {upsellProducts.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <span style={{ fontSize: '12px', color: '#475569' }}>{p.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#94A3B8' }}>+{p.price.toLocaleString('da-DK')} {p.currency}{p.type === 'mrr' ? '/md' : ''}</span>
                        <button
                          onClick={() => toggleProduct(p)}
                          style={{ fontSize: '11px', color: '#185FA5', background: 'rgba(24,95,165,0.15)', border: '1px solid rgba(24,95,165,0.3)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer' }}
                        >
                          Tilføj
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== MEDLEMMER ===== */}
          {tab === 'Medlemmer' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '12px', color: '#94A3B8', lineHeight: 1.5 }}>
                Medarbejdere herunder har adgang til kundens messenger-tråd og projekt-board.
              </div>

              {/* Current members */}
              <div>
                <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Nuværende ({members.length})
                </div>
                {members.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>Ingen tilknyttede medarbejdere endnu</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {members.map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E84025', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {m.name[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', color: '#1E293B', fontWeight: 500 }}>{m.name}</div>
                          <div style={{ fontSize: '10px', color: '#94A3B8' }}>{m.email}</div>
                        </div>
                        <span style={{ fontSize: '10px', color: m.role === 'admin' ? '#E84025' : '#94A3B8', textTransform: 'uppercase', fontWeight: 600 }}>
                          {m.role === 'admin' ? 'Admin' : 'Sælger'}
                        </span>
                        <button
                          disabled={memberSaving === m.id}
                          onClick={async () => {
                            setMemberSaving(m.id);
                            await fetch(`/api/customers/${customer.id}/members?user_id=${m.id}`, { method: 'DELETE' });
                            loadMembers();
                            setMemberSaving(null);
                            toast.success(`${m.name} fjernet`);
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, display: 'flex', borderRadius: 4 }}
                          title="Fjern"
                        >
                          <Minus size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add members */}
              {allUsers.filter(u => !members.some(m => m.id === u.id)).length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Tilføj medarbejder
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {allUsers.filter(u => !members.some(m => m.id === u.id)).map(u => (
                      <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#475569', flexShrink: 0 }}>
                          {u.name[0].toUpperCase()}
                        </div>
                        <span style={{ flex: 1, fontSize: '13px', color: '#475569' }}>{u.name}</span>
                        <button
                          disabled={memberSaving === u.id}
                          onClick={async () => {
                            setMemberSaving(u.id);
                            await fetch(`/api/customers/${customer.id}/members`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ user_id: u.id }),
                            });
                            loadMembers();
                            setMemberSaving(null);
                            toast.success(`${u.name} tilføjet`);
                          }}
                          style={{ background: 'rgba(232,64,37,0.12)', border: '1px solid rgba(232,64,37,0.3)', borderRadius: 6, padding: '4px 10px', color: '#E84025', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Plus size={11} /> Tilføj
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== PORTAL ===== */}
          {tab === 'Portal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Status banner */}
              <div style={{
                background: portalEnabled ? 'rgba(46,204,113,0.08)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${portalEnabled ? 'rgba(46,204,113,0.25)' : 'rgba(0,0,0,0.08)'}`,
                borderRadius: '8px', padding: '14px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Globe size={16} color={portalEnabled ? '#2ECC71' : '#94A3B8'} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: portalEnabled ? '#2ECC71' : '#475569' }}>
                      {portalEnabled ? 'Portaladgang aktiv' : 'Ingen portaladgang'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: 1 }}>
                      {portalEnabled ? portalEmail : 'Kunden kan ikke logge ind endnu'}
                    </div>
                  </div>
                </div>
                {portalEnabled && (
                  <button
                    onClick={async () => {
                      await fetch('/api/portal/setup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ customer_id: customer.id, enabled: false }),
                      });
                      setPortalEnabled(false);
                      toast.success('Portaladgang deaktiveret');
                    }}
                    style={{ fontSize: '11px', color: '#E74C3C', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.2)', borderRadius: '5px', padding: '4px 10px', cursor: 'pointer' }}
                  >
                    Deaktiver
                  </button>
                )}
              </div>

              {/* Portal link */}
              {portalEnabled && (
                <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Portal-link til kunden
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <code style={{ flex: 1, fontSize: '11px', color: '#475569', background: '#F1F5F9', padding: '7px 10px', borderRadius: '5px', border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {typeof window !== 'undefined' ? `${window.location.origin}/portal` : '/portal'}
                    </code>
                    <button
                      onClick={() => {
                        const url = typeof window !== 'undefined' ? `${window.location.origin}/portal` : '/portal';
                        navigator.clipboard.writeText(url).then(() => {
                          setPortalCopied(true);
                          setTimeout(() => setPortalCopied(false), 2000);
                        });
                      }}
                      style={{ background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '5px', padding: '6px 10px', cursor: 'pointer', color: portalCopied ? '#2ECC71' : '#94A3B8', flexShrink: 0 }}
                      title="Kopiér link"
                    >
                      {portalCopied ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                    <a
                      href="/portal"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ background: 'rgba(24,95,165,0.12)', border: '1px solid rgba(24,95,165,0.25)', borderRadius: '5px', padding: '6px 10px', cursor: 'pointer', color: '#185FA5', display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}
                      title="Åbn portal"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              )}

              {/* Setup form */}
              <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                  {portalEnabled ? 'Opdater login-oplysninger' : 'Aktiver portaladgang'}
                </div>

                <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '5px' }}>Email (bruges til login)</div>
                <input
                  type="email"
                  value={portalEmail}
                  onChange={e => setPortalEmail(e.target.value)}
                  placeholder={customer.contact_email || 'email@firma.dk'}
                  style={{ ...inputStyle, marginBottom: '10px' }}
                />

                <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '5px' }}>
                  {portalEnabled ? 'Ny adgangskode (lad stå blank for at beholde)' : 'Adgangskode'}
                </div>
                <div style={{ position: 'relative', marginBottom: '12px' }}>
                  <input
                    type={showPortalPw ? 'text' : 'password'}
                    value={portalPassword}
                    onChange={e => setPortalPassword(e.target.value)}
                    placeholder={portalEnabled ? '(uændret)' : 'Vælg en adgangskode'}
                    style={{ ...inputStyle, marginBottom: 0, paddingRight: '36px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPortalPw(p => !p)}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2 }}
                  >
                    {showPortalPw ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>

                <button
                  onClick={async () => {
                    if (!portalEmail.trim()) { toast.error('Email er påkrævet'); return; }
                    if (!portalEnabled && !portalPassword.trim()) { toast.error('Adgangskode er påkrævet ved første aktivering'); return; }
                    setPortalSaving(true);
                    try {
                      const res = await fetch('/api/portal/setup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          customer_id: customer.id,
                          portal_email: portalEmail,
                          password: portalPassword || undefined,
                          enabled: true,
                        }),
                      });
                      const data = await res.json();
                      if (res.ok) {
                        setPortalEnabled(true);
                        setPortalPassword('');
                        toast.success(portalEnabled ? 'Portal opdateret' : 'Portaladgang aktiveret');
                      } else {
                        toast.error(data.error || 'Fejl');
                      }
                    } finally {
                      setPortalSaving(false);
                    }
                  }}
                  disabled={portalSaving || !portalEmail.trim()}
                  style={{
                    width: '100%', background: !portalSaving && portalEmail.trim() ? '#185FA5' : 'rgba(0,0,0,0.06)',
                    border: 'none', borderRadius: '6px', padding: '9px', color: !portalSaving && portalEmail.trim() ? '#fff' : '#94A3B8',
                    fontSize: '13px', fontWeight: 500, cursor: !portalSaving && portalEmail.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  {portalSaving ? 'Gemmer...' : portalEnabled ? 'Opdater' : 'Aktiver portal'}
                </button>
              </div>

              <div style={{ fontSize: '11px', color: '#E2E8F0', lineHeight: 1.6, padding: '0 2px' }}>
                Kunden kan logge ind på portalen med sin email og adgangskode og se kontraktoplysninger, produkter og tilknyttede projekter.
              </div>
            </div>
          )}

          {/* ===== NOTER ===== */}
          {tab === 'Noter' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Add note */}
              <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Tilføj note</div>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote(); }}
                  placeholder="Log en aktivitet, et opkald, et møde..."
                  style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                />
                <button onClick={handleAddNote} style={{
                  background: 'rgba(24,95,165,0.2)', border: '1px solid rgba(24,95,165,0.4)',
                  borderRadius: '6px', padding: '6px 14px', color: '#185FA5', fontSize: '12px', cursor: 'pointer',
                }}>
                  Tilføj note
                </button>
              </div>

              {/* Notes list */}
              {notes.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94A3B8', padding: '32px', fontSize: '13px' }}>
                  Ingen noter endnu — log aktiviteter her
                </div>
              ) : (
                notes.map(note => (
                  <div key={note.id} style={{ display: 'flex', gap: '10px', padding: '12px', background: '#FFFFFF', borderRadius: '8px' }}>
                    <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(24,95,165,0.15)', color: '#185FA5', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={12} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: '#1E293B', lineHeight: 1.5, wordBreak: 'break-word' }}>{note.content}</div>
                      <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>
                        {note.created_by === 'human' ? '👤' : '🤖'} {timeAgo(note.created_at)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
