'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X, Mail, Phone, Edit3, Calendar, FileText, ShoppingBag,
  TrendingUp, AlertTriangle, CheckCircle, Clock, ExternalLink,
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
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  type: 'mrr' | 'onetime';
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
      <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
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
  background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '6px', padding: '7px 10px', color: '#ECF0F1',
  fontSize: '12px', width: '100%', outline: 'none', boxSizing: 'border-box',
  marginBottom: '8px',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none',
  WebkitAppearance: 'none',
};

export default function CustomerDrawer({ customer, onClose, onUpdate }: {
  customer: Customer;
  onClose: () => void;
  onUpdate: (id: string, changes: Partial<Customer>) => Promise<void>;
}) {
  const [tab, setTab] = useState<'Overblik' | 'Produkter' | 'Noter'>('Overblik');
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Customer>>({});
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [customerProducts, setCustomerProducts] = useState<Product[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState('');

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

  useEffect(() => {
    loadProducts();
    loadNotes();
  }, [loadProducts, loadNotes]);

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

  const renewDays = daysUntil(customer.contract_end);
  const mrrProducts = customerProducts.filter(p => p.type === 'mrr');
  const onetimeProducts = customerProducts.filter(p => p.type === 'onetime');
  const totalMrr = mrrProducts.reduce((s, p) => s + p.price, 0);
  const totalOnetime = onetimeProducts.reduce((s, p) => s + p.price, 0);
  const upsellProducts = allProducts.filter(p => !customerProducts.some(cp => cp.id === p.id));

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 201,
        width: '500px', background: '#111E2A',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#ECF0F1' }}>{customer.company}</h2>
                <span style={{ fontSize: '12px', color: '#667788' }}>{MARKETS[customer.market] ?? customer.market}</span>
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
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#667788', padding: '4px', flexShrink: 0 }}>
              <X size={18} />
            </button>
          </div>

          {/* KPI strip */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <div style={{ flex: 1, background: '#1A2A38', borderRadius: '6px', padding: '8px 10px' }}>
              <div style={{ fontSize: '10px', color: '#667788', display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '3px' }}>
                <TrendingUp size={11} /> MRR
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#2ECC71' }}>
                {totalMrr > 0 ? `${totalMrr.toLocaleString('da-DK')} DKK` : '—'}
              </div>
              {totalMrr > 0 && <div style={{ fontSize: '10px', color: '#667788', marginTop: '1px' }}>{(totalMrr * 12).toLocaleString('da-DK')} DKK/år</div>}
            </div>
            {totalOnetime > 0 && (
              <div style={{ flex: 1, background: '#1A2A38', borderRadius: '6px', padding: '8px 10px' }}>
                <div style={{ fontSize: '10px', color: '#667788', display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '3px' }}>
                  <TrendingUp size={11} /> Engangs
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#F39C12' }}>
                  {totalOnetime.toLocaleString('da-DK')} DKK
                </div>
              </div>
            )}
            <div style={{ flex: 1, background: '#1A2A38', borderRadius: '6px', padding: '8px 10px' }}>
              <div style={{ fontSize: '10px', color: '#667788', display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '3px' }}>
                <CheckCircle size={11} /> Health
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: customer.health_score >= 70 ? '#2ECC71' : customer.health_score >= 40 ? '#F39C12' : '#E74C3C' }}>
                {customer.health_score ?? 0}/100
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
            <button
              onClick={() => { setEditing(!editing); if (!editing) setEditData({ ...customer }); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px', padding: '6px 12px', color: '#ECF0F1', fontSize: '12px', cursor: 'pointer',
              }}
            >
              <Edit3 size={12} /> {editing ? 'Annuller' : 'Rediger'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          {(['Overblik', 'Produkter', 'Noter'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '10px', border: 'none', background: 'transparent',
              color: tab === t ? '#ECF0F1' : '#667788',
              borderBottom: `2px solid ${tab === t ? '#185FA5' : 'transparent'}`,
              fontSize: '13px', fontWeight: tab === t ? 600 : 400, cursor: 'pointer',
            }}>
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* ===== OVERBLIK ===== */}
          {tab === 'Overblik' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Health score */}
              <div style={{ background: '#1A2A38', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: '#667788', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
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
              <div style={{ background: '#1A2A38', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: '#667788', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Kontaktperson</div>
                {editing ? (
                  <>
                    <input placeholder="Navn" value={editData.contact_name || ''} onChange={e => setEditData(p => ({ ...p, contact_name: e.target.value }))} style={inputStyle} />
                    <input placeholder="Titel" value={editData.contact_title || ''} onChange={e => setEditData(p => ({ ...p, contact_title: e.target.value }))} style={inputStyle} />
                    <input placeholder="Email" value={editData.contact_email || ''} onChange={e => setEditData(p => ({ ...p, contact_email: e.target.value }))} style={inputStyle} />
                    <input placeholder="Telefon" value={editData.contact_phone || ''} onChange={e => setEditData(p => ({ ...p, contact_phone: e.target.value }))} style={{ ...inputStyle, marginBottom: 0 }} />
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#ECF0F1' }}>{customer.contact_name || '—'}</div>
                    {customer.contact_title && <div style={{ fontSize: '12px', color: '#667788' }}>{customer.contact_title}</div>}
                    {customer.contact_email && (
                      <a href={`mailto:${customer.contact_email}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#185FA5', fontSize: '12px', textDecoration: 'none' }}>
                        <Mail size={12} /> {customer.contact_email}
                      </a>
                    )}
                    {customer.contact_phone && (
                      <a href={`tel:${customer.contact_phone}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#667788', fontSize: '12px', textDecoration: 'none' }}>
                        <Phone size={12} /> {customer.contact_phone}
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Contract */}
              <div style={{ background: '#1A2A38', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: '#667788', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Kontrakt</div>
                {editing ? (
                  <>
                    <div style={{ fontSize: '11px', color: '#667788', marginBottom: '4px' }}>Startdato</div>
                    <input type="date" value={editData.contract_start || ''} onChange={e => setEditData(p => ({ ...p, contract_start: e.target.value }))} style={inputStyle} />
                    <div style={{ fontSize: '11px', color: '#667788', marginBottom: '4px' }}>Slutdato</div>
                    <input type="date" value={editData.contract_end || ''} onChange={e => setEditData(p => ({ ...p, contract_end: e.target.value }))} style={inputStyle} />
                    <div style={{ fontSize: '11px', color: '#667788', marginBottom: '4px' }}>Churn-risiko</div>
                    <select value={editData.churn_risk || 'low'} onChange={e => setEditData(p => ({ ...p, churn_risk: e.target.value as 'low' | 'medium' | 'high' }))} style={selectStyle}>
                      {CHURN_RISKS.map(r => <option key={r} value={r}>{r === 'low' ? 'Lav' : r === 'medium' ? 'Medium' : 'Høj'}</option>)}
                    </select>
                    <div style={{ fontSize: '11px', color: '#667788', marginBottom: '4px' }}>Health score (0-100)</div>
                    <input type="number" min={0} max={100} value={editData.health_score ?? ''} onChange={e => setEditData(p => ({ ...p, health_score: Number(e.target.value) }))} style={inputStyle} />
                    <div style={{ fontSize: '11px', color: '#667788', marginBottom: '4px' }}>Segment</div>
                    <select value={editData.segment || 'smb'} onChange={e => setEditData(p => ({ ...p, segment: e.target.value }))} style={{ ...selectStyle, marginBottom: 0 }}>
                      {SEGMENTS.map(s => <option key={s} value={s}>{s === 'smb' ? 'SMB' : s === 'mid-market' ? 'Mid-Market' : 'Enterprise'}</option>)}
                    </select>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#667788', display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={11} /> Start</span>
                      <span style={{ fontSize: '12px', color: '#ECF0F1' }}>{formatDate(customer.contract_start)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#667788', display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={11} /> Udløber</span>
                      <span style={{ fontSize: '12px', color: renewDays < 60 ? '#F39C12' : '#ECF0F1' }}>
                        {formatDate(customer.contract_end)}
                        {renewDays > 0 && renewDays < 365 && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#667788' }}>({renewDays}d)</span>}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#667788' }}>Segment</span>
                      <span style={{ fontSize: '12px', color: '#ECF0F1', textTransform: 'capitalize' }}>
                        {customer.segment === 'smb' ? 'SMB' : customer.segment === 'mid-market' ? 'Mid-Market' : customer.segment}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Internal notes */}
              <div style={{ background: '#1A2A38', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: '#667788', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Interne noter</div>
                {editing ? (
                  <textarea
                    value={editData.notes || ''}
                    onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Interne noter om kunden..."
                    style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', marginBottom: 0 }}
                  />
                ) : (
                  <p style={{ margin: 0, fontSize: '12px', color: '#AAB8C2', lineHeight: 1.6 }}>
                    {customer.notes || <span style={{ color: '#667788' }}>Ingen noter endnu</span>}
                  </p>
                )}
              </div>

              {editing && (
                <button onClick={handleSave} style={{ background: '#185FA5', border: 'none', borderRadius: '6px', padding: '10px', color: '#ECF0F1', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>
                  Gem ændringer
                </button>
              )}
            </div>
          )}

          {/* ===== PRODUKTER ===== */}
          {tab === 'Produkter' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Active products */}
              <div style={{ background: '#1A2A38', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: '#667788', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShoppingBag size={12} /> Aktive produkter
                </div>
                {allProducts.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#667788', textAlign: 'center', padding: '20px 0' }}>Ingen produkter oprettet endnu</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {allProducts.map(product => {
                      const selected = customerProducts.some(p => p.id === product.id);
                      return (
                        <button
                          key={product.id}
                          onClick={() => toggleProduct(product)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', textAlign: 'left',
                            background: selected ? 'rgba(24,95,165,0.15)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${selected ? 'rgba(24,95,165,0.5)' : 'rgba(255,255,255,0.07)'}`,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                              background: selected ? '#185FA5' : 'rgba(255,255,255,0.08)',
                              border: `1px solid ${selected ? '#185FA5' : 'rgba(255,255,255,0.15)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {selected && <span style={{ color: '#fff', fontSize: '10px' }}>✓</span>}
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: 500, color: selected ? '#ECF0F1' : '#AAB8C2' }}>{product.name}</div>
                              {product.description && <div style={{ fontSize: '10px', color: '#667788', marginTop: '1px' }}>{product.description}</div>}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: selected ? '#185FA5' : '#667788' }}>
                              {product.price.toLocaleString('da-DK')} {product.currency}
                            </span>
                            <span style={{ fontSize: '10px', color: '#667788', display: 'block' }}>
                              {product.type === 'mrr' ? '/md' : 'engangsbetaling'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {customerProducts.length > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {totalMrr > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#667788' }}>MRR (månedlig betaling)</span>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#2ECC71' }}>{totalMrr.toLocaleString('da-DK')} DKK/md</span>
                          <span style={{ fontSize: '10px', color: '#667788', display: 'block' }}>{(totalMrr * 12).toLocaleString('da-DK')} DKK/år</span>
                        </div>
                      </div>
                    )}
                    {totalOnetime > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#667788' }}>Engangsbetalinger</span>
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
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ fontSize: '12px', color: '#AAB8C2' }}>{p.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#667788' }}>+{p.price.toLocaleString('da-DK')} {p.currency}{p.type === 'mrr' ? '/md' : ''}</span>
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

          {/* ===== NOTER ===== */}
          {tab === 'Noter' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Add note */}
              <div style={{ background: '#1A2A38', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: '#667788', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Tilføj note</div>
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
                <div style={{ textAlign: 'center', color: '#667788', padding: '32px', fontSize: '13px' }}>
                  Ingen noter endnu — log aktiviteter her
                </div>
              ) : (
                notes.map(note => (
                  <div key={note.id} style={{ display: 'flex', gap: '10px', padding: '12px', background: '#1A2A38', borderRadius: '8px' }}>
                    <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(24,95,165,0.15)', color: '#185FA5', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={12} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: '#ECF0F1', lineHeight: 1.5, wordBreak: 'break-word' }}>{note.content}</div>
                      <div style={{ fontSize: '10px', color: '#667788', marginTop: '4px' }}>
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
