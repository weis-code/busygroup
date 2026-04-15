'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X, ExternalLink, Mail, Phone, Edit3, MessageSquare, Calendar,
  FileText, ArrowRight, ShoppingBag, PhoneCall, Trash2, StickyNote,
  Copy, Check, Send, Globe,
} from 'lucide-react';
import { LeadStatusBadge, MarketBadge } from './StatusBadge';
import { toast } from 'sonner';

interface Lead {
  id: string;
  company: string;
  contact_name: string;
  contact_title: string;
  linkedin_url: string;
  email: string;
  phone: string;
  company_size: string;
  why_they_fit: string;
  priority: string;
  status: string;
  market: string;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
  // Swedish outreach fields
  country?: string | null;
  vertical?: string | null;
  research_notes?: string | null;
  email_subject?: string | null;
  email_body?: string | null;
  decision_maker_name?: string | null;
  decision_maker_title?: string | null;
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

interface HistoryItem {
  id: string;
  type: 'log' | 'sequence' | 'meeting' | 'note';
  action?: string;
  details?: string;
  message?: string;
  content?: string;
  result?: string;
  sort_at: string;
  created_at: string;
}


const STATUS_ORDER = ['new', 'contacted', 'replied', 'interested', 'booked', 'won', 'lost'];
const STATUS_LABELS: Record<string, string> = {
  new: 'Ny', contacted: 'Kontaktet', replied: 'Svaret',
  interested: 'Interesseret', booked: 'Booket', won: 'Vundet', lost: 'Tabt',
};

function timeAgo(dateStr: string): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'Lige nu';
  if (mins < 60) return `${mins}m siden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}t siden`;
  return new Date(dateStr).toLocaleDateString('da-DK');
}



function HistoryIcon({ type, result }: { type: string; result?: string }) {
  const colorMap: Record<string, string> = { success: '#2ECC71', error: '#E74C3C', warning: '#F39C12', info: '#185FA5' };
  const color = result ? (colorMap[result] || '#667788') : '#667788';
  const icons: Record<string, React.ReactNode> = {
    log: <FileText size={12} />,
    sequence: <MessageSquare size={12} />,
    meeting: <Calendar size={12} />,
    note: <Edit3 size={12} />,
  };
  return (
    <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: `${color}20`, color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {icons[type] || <FileText size={12} />}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '6px', padding: '7px 10px', color: '#ECF0F1',
  fontSize: '12px', width: '100%', outline: 'none', boxSizing: 'border-box',
  marginBottom: '8px',
};
const textareaStyle: React.CSSProperties = {
  ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5',
};
const sectionLabel: React.CSSProperties = {
  fontSize: '10px', color: '#667788', textTransform: 'uppercase', letterSpacing: '0.06em',
  marginBottom: '6px', fontWeight: 600,
};
const card: React.CSSProperties = {
  background: '#1A2A38', borderRadius: '8px', padding: '14px', marginBottom: '10px',
};

export default function LeadDrawer({ lead, onClose, onUpdate }: {
  lead: Lead;
  onClose: () => void;
  onUpdate: (id: string, changes: Partial<Lead>) => Promise<void>;
}) {
  const isSE = lead.country === 'SE' || lead.market === 'sweden';
  const [tab, setTab] = useState<'Overblik' | 'Outreach' | 'Historik'>('Overblik');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Lead>>({});
  const [noteText, setNoteText] = useState('');
  const [callLogText, setCallLogText] = useState('');
  const [loggingCall, setLoggingCall] = useState(false);
  const [showQuickNote, setShowQuickNote] = useState(false);
  const [quickNoteText, setQuickNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [leadProducts, setLeadProducts] = useState<Product[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // SE outreach state
  const [editSubject, setEditSubject] = useState(lead.email_subject || '');
  const [editBody, setEditBody] = useState(lead.email_body || '');
  const [copied, setCopied] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  const loadHistory = useCallback(() => {
    fetch(`/api/leads/${lead.id}/history`)
      .then(r => r.json())
      .then(data => setHistory(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [lead.id]);

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => setAllProducts(Array.isArray(d) ? d.filter((p: Product) => p.active) : [])).catch(() => {});
    fetch(`/api/leads/${lead.id}/products`).then(r => r.json()).then(d => setLeadProducts(Array.isArray(d) ? d : [])).catch(() => {});
    loadHistory();
  }, [lead.id, loadHistory]);

  const toggleProduct = async (product: Product) => {
    const isSelected = leadProducts.some(p => p.id === product.id);
    try {
      const res = await fetch(`/api/leads/${lead.id}/products`, {
        method: isSelected ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id }),
      });
      const updated = await res.json();
      setLeadProducts(Array.isArray(updated) ? updated : []);
    } catch { toast.error('Fejl ved opdatering af produkt'); }
  };

  const handleSave = async () => {
    await onUpdate(lead.id, editData);
    setEditing(false);
    toast.success('Lead opdateret');
  };

  const handleNextStatus = async () => {
    const idx = STATUS_ORDER.indexOf(lead.status);
    if (idx === -1 || idx >= STATUS_ORDER.length - 1) return;
    const next = STATUS_ORDER[idx + 1];
    await onUpdate(lead.id, { status: next });
    toast.success(`Status → ${STATUS_LABELS[next]}`);
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    try {
      await fetch(`/api/leads/${lead.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteText }),
      });
      setNoteText('');
      toast.success('Note tilføjet');
      loadHistory();
    } catch { toast.error('Fejl ved tilføjelse af note'); }
  };

  const handleQuickNote = async () => {
    if (!quickNoteText.trim()) return;
    setSavingNote(true);
    try {
      await fetch(`/api/leads/${lead.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: quickNoteText }),
      });
      setQuickNoteText('');
      setShowQuickNote(false);
      toast.success('Note gemt');
      loadHistory();
    } catch { toast.error('Fejl ved tilføjelse af note'); }
    finally { setSavingNote(false); }
  };

  const handleLogCall = async () => {
    if (!callLogText.trim()) return;
    setLoggingCall(true);
    try {
      await fetch(`/api/leads/${lead.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `📞 Opkald: ${callLogText}`, type: 'log' }),
      });
      toast.success('Opkald logget');
      setCallLogText('');
      loadHistory();
    } catch { toast.error('Fejl ved logning af opkald'); }
    finally { setLoggingCall(false); }
  };

  const nextIdx = STATUS_ORDER.indexOf(lead.status) + 1;
  const nextSt = nextIdx < STATUS_ORDER.length ? STATUS_ORDER[nextIdx] : null;

  // SE outreach helpers
  const handleCopyEmail = () => {
    const text = `Ämne: ${editSubject}\n\n${editBody}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSaveEmail = async () => {
    setSavingEmail(true);
    try {
      await onUpdate(lead.id, { email_subject: editSubject, email_body: editBody });
      toast.success('E-mail gemt');
    } catch { toast.error('Fejl ved gemning'); }
    finally { setSavingEmail(false); }
  };

  const handleMarkSent = async () => {
    await onUpdate(lead.id, { status: 'contacted' });
    toast.success('Markeret som sendt');
  };

  const handleMarkReplied = async () => {
    await onUpdate(lead.id, { status: 'replied' });
    toast.success('Svar registreret');
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 201,
        width: '520px', background: '#111E2A',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
      }}>

        {/* ── Header ── */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#ECF0F1' }}>{lead.company}</h2>
                <MarketBadge market={lead.market} />
                {isSE && (
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#FCD200', background: 'rgba(252,210,0,0.12)', border: '1px solid rgba(252,210,0,0.3)', borderRadius: '4px', padding: '1px 5px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <Globe size={8} /> SE
                  </span>
                )}
                {isSE && lead.vertical && (
                  <span style={{ fontSize: '9px', fontWeight: 600, color: '#9B59B6', background: 'rgba(155,89,182,0.12)', border: '1px solid rgba(155,89,182,0.25)', borderRadius: '4px', padding: '1px 5px' }}>
                    {lead.vertical === 'klinik' ? '🏥 Klinik' : '🔧 Hantverkare'}
                  </span>
                )}
                {lead.priority === 'high' && <span style={{ color: '#E74C3C', fontSize: '10px', fontWeight: 700 }}>● HØJ</span>}
              </div>
              <LeadStatusBadge status={lead.status} />
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#667788', padding: '4px' }}><X size={18} /></button>
          </div>

          {/* Action bar */}
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '10px' }}>
            {lead.phone && (
              <a href={`tel:${lead.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(46,204,113,0.12)', border: '1px solid rgba(46,204,113,0.3)', borderRadius: '6px', padding: '5px 10px', color: '#2ECC71', fontSize: '11px', fontWeight: 600, textDecoration: 'none' }}>
                <PhoneCall size={11} /> Ring nu
              </a>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(24,95,165,0.12)', border: '1px solid rgba(24,95,165,0.3)', borderRadius: '6px', padding: '5px 10px', color: '#185FA5', fontSize: '11px', fontWeight: 600, textDecoration: 'none' }}>
                <Mail size={11} /> Send email
              </a>
            )}
            {nextSt && (
              <button onClick={handleNextStatus} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#185FA5', border: 'none', borderRadius: '6px', padding: '5px 10px', color: '#ECF0F1', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                <ArrowRight size={11} /> {STATUS_LABELS[nextSt]}
              </button>
            )}
            <button onClick={() => { setTab('Historik'); setCallLogText(' '); setTimeout(() => setCallLogText(''), 10); }} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '5px 10px', color: '#ECF0F1', fontSize: '11px', cursor: 'pointer' }}>
              <PhoneCall size={11} /> Log opkald
            </button>
            <button
              onClick={() => { setShowQuickNote(v => !v); setQuickNoteText(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                background: showQuickNote ? 'rgba(243,156,18,0.15)' : 'rgba(255,255,255,0.06)',
                border: showQuickNote ? '1px solid rgba(243,156,18,0.4)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px', padding: '5px 10px',
                color: showQuickNote ? '#F39C12' : '#ECF0F1',
                fontSize: '11px', cursor: 'pointer',
              }}
            >
              <StickyNote size={11} /> Log note
            </button>
            <button onClick={() => { setEditing(!editing); if (!editing) setEditData({ ...lead }); }} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '5px 10px', color: '#ECF0F1', fontSize: '11px', cursor: 'pointer' }}>
              <Edit3 size={11} /> {editing ? 'Annuller' : 'Rediger'}
            </button>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.2)', borderRadius: '6px', padding: '5px 10px', color: '#E74C3C', fontSize: '11px', cursor: 'pointer' }}>
                <Trash2 size={11} /> Slet
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#E74C3C' }}>Er du sikker?</span>
                <button
                  onClick={async () => {
                    await onUpdate(lead.id, { status: 'deleted' });
                    toast.success(`${lead.company} slettet`);
                    onClose();
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#E74C3C', border: 'none', borderRadius: '6px', padding: '5px 10px', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                >
                  <Trash2 size={11} /> Ja, slet
                </button>
                <button onClick={() => setConfirmDelete(false)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '5px 10px', color: '#ECF0F1', fontSize: '11px', cursor: 'pointer' }}>
                  Annuller
                </button>
              </div>
            )}
          </div>

          {/* Quick note form */}
          {showQuickNote && (
            <div style={{
              marginTop: '10px', background: 'rgba(243,156,18,0.06)',
              border: '1px solid rgba(243,156,18,0.2)', borderRadius: '8px', padding: '10px 12px',
            }}>
              <textarea
                autoFocus
                value={quickNoteText}
                onChange={e => setQuickNoteText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleQuickNote();
                  if (e.key === 'Escape') { setShowQuickNote(false); setQuickNoteText(''); }
                }}
                placeholder="Skriv en note... (Cmd+Enter for at gemme)"
                style={{
                  ...textareaStyle, minHeight: '64px', marginBottom: '8px',
                  background: '#0F1923', border: '1px solid rgba(243,156,18,0.25)',
                }}
              />
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowQuickNote(false); setQuickNoteText(''); }}
                  style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '5px 12px', color: '#667788', fontSize: '11px', cursor: 'pointer' }}
                >
                  Annuller
                </button>
                <button
                  onClick={handleQuickNote}
                  disabled={!quickNoteText.trim() || savingNote}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    background: quickNoteText.trim() ? '#F39C12' : 'rgba(243,156,18,0.2)',
                    border: 'none', borderRadius: '6px', padding: '5px 14px',
                    color: quickNoteText.trim() ? '#0F1923' : '#667788',
                    fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <StickyNote size={11} /> {savingNote ? 'Gemmer...' : 'Gem note'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          {(['Overblik', ...(isSE ? ['Outreach'] : []), 'Historik'] as const).map(t => (
            <button key={t} onClick={() => setTab(t as typeof tab)} style={{
              flex: 1, padding: '9px 4px', border: 'none', background: 'transparent',
              color: tab === t ? '#ECF0F1' : '#667788',
              borderBottom: `2px solid ${tab === t ? '#185FA5' : 'transparent'}`,
              fontSize: '12px', fontWeight: tab === t ? 600 : 400, cursor: 'pointer', position: 'relative',
            }}>
              {t}
              {t === 'Outreach' && lead.email_body && (
                <span style={{ position: 'absolute', top: '6px', right: '8px', width: '5px', height: '5px', borderRadius: '50%', background: '#2ECC71' }} />
              )}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>

          {/* ========= OVERBLIK ========= */}
          {tab === 'Overblik' && (
            <div>
              {/* Contact */}
              <div style={card}>
                <div style={sectionLabel}>Kontakt</div>
                {editing ? (
                  <>
                    <input placeholder="Navn" value={editData.contact_name || ''} onChange={e => setEditData(p => ({ ...p, contact_name: e.target.value }))} style={inputStyle} />
                    <input placeholder="Titel" value={editData.contact_title || ''} onChange={e => setEditData(p => ({ ...p, contact_title: e.target.value }))} style={inputStyle} />
                    <input placeholder="LinkedIn URL" value={editData.linkedin_url || ''} onChange={e => setEditData(p => ({ ...p, linkedin_url: e.target.value }))} style={inputStyle} />
                    <input placeholder="Email" value={editData.email || ''} onChange={e => setEditData(p => ({ ...p, email: e.target.value }))} style={inputStyle} />
                    <input placeholder="Telefon" value={editData.phone || ''} onChange={e => setEditData(p => ({ ...p, phone: e.target.value }))} style={{ ...inputStyle, marginBottom: 0 }} />
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#ECF0F1' }}>{lead.contact_name || '—'}</div>
                    {lead.contact_title && <div style={{ fontSize: '12px', color: '#667788' }}>{lead.contact_title}</div>}
                    {lead.linkedin_url && <a href={lead.linkedin_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#185FA5', fontSize: '12px', textDecoration: 'none' }}><ExternalLink size={11} /> LinkedIn</a>}
                    {lead.email && <a href={`mailto:${lead.email}`} style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#667788', fontSize: '12px', textDecoration: 'none' }}><Mail size={11} /> {lead.email}</a>}
                    {lead.phone && <a href={`tel:${lead.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#667788', fontSize: '12px', textDecoration: 'none' }}><Phone size={11} /> {lead.phone}</a>}
                  </div>
                )}
              </div>

              {/* Company */}
              <div style={card}>
                <div style={sectionLabel}>Firma</div>
                {editing ? (
                  <>
                    <input placeholder="Firmastørrelse" value={editData.company_size || ''} onChange={e => setEditData(p => ({ ...p, company_size: e.target.value }))} style={inputStyle} />
                    <textarea placeholder="Hvorfor de passer" value={editData.why_they_fit || ''} onChange={e => setEditData(p => ({ ...p, why_they_fit: e.target.value }))} style={{ ...textareaStyle, minHeight: '70px', marginBottom: 0 }} />
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {lead.company_size && <div style={{ fontSize: '12px', color: '#ECF0F1' }}>{lead.company_size}</div>}
                    {lead.why_they_fit && <div style={{ fontSize: '12px', color: '#667788', lineHeight: 1.5 }}>{lead.why_they_fit}</div>}
                  </div>
                )}
              </div>

              {editing && (
                <button onClick={handleSave} style={{ width: '100%', background: '#185FA5', border: 'none', borderRadius: '6px', padding: '9px', color: '#ECF0F1', fontSize: '13px', cursor: 'pointer', fontWeight: 500, marginBottom: '10px' }}>
                  Gem ændringer
                </button>
              )}

              {/* Product interest */}
              {allProducts.length > 0 && (
                <div style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
                    <ShoppingBag size={12} style={{ color: '#667788' }} />
                    <span style={sectionLabel}>Produktinteresse</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {allProducts.map(product => {
                      const selected = leadProducts.some(p => p.id === product.id);
                      return (
                        <button key={product.id} onClick={() => toggleProduct(product)} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '7px 9px', borderRadius: '6px', cursor: 'pointer', textAlign: 'left',
                          background: selected ? 'rgba(24,95,165,0.15)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${selected ? 'rgba(24,95,165,0.5)' : 'rgba(255,255,255,0.07)'}`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <div style={{ width: '15px', height: '15px', borderRadius: '4px', flexShrink: 0, background: selected ? '#185FA5' : 'rgba(255,255,255,0.08)', border: `1px solid ${selected ? '#185FA5' : 'rgba(255,255,255,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {selected && <span style={{ color: '#fff', fontSize: '9px' }}>✓</span>}
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: 500, color: selected ? '#ECF0F1' : '#AAB8C2' }}>{product.name}</div>
                              {product.description && <div style={{ fontSize: '10px', color: '#667788' }}>{product.description}</div>}
                            </div>
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: selected ? '#185FA5' : '#667788', marginLeft: '8px', flexShrink: 0 }}>
                            {product.price.toLocaleString('da-DK')} {product.currency}{product.type === 'mrr' ? '/md' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {leadProducts.length > 0 && (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '11px', color: '#667788' }}>
                      Estimeret værdi: <span style={{ color: '#2ECC71', fontWeight: 600 }}>
                        {leadProducts.reduce((s, p) => s + (p.type === 'mrr' ? p.price * 12 : p.price), 0).toLocaleString('da-DK')} DKK/år
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}


          {/* ========= OUTREACH (SE) ========= */}
          {tab === 'Outreach' && isSE && (
            <div>

              {/* Research notes */}
              {lead.research_notes && (
                <div style={{ ...card, border: '1px solid rgba(155,89,182,0.2)', marginBottom: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#9B59B6', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FileText size={11} /> Research
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {lead.research_notes.split('\n').filter(Boolean).map((line, i) => (
                      <div key={i} style={{ fontSize: '12px', color: '#AAB8C2', lineHeight: 1.5 }}>{line}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Email draft */}
              <div style={{ ...card, border: '1px solid rgba(24,95,165,0.2)', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#185FA5', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Mail size={11} /> E-mail udkast
                </div>

                {(editSubject || lead.email_subject) ? (
                  <>
                    <div style={{ fontSize: '10px', color: '#667788', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ämne</div>
                    <input
                      value={editSubject}
                      onChange={e => setEditSubject(e.target.value)}
                      style={{
                        background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px', padding: '7px 10px', color: '#ECF0F1',
                        fontSize: '12px', width: '100%', outline: 'none', boxSizing: 'border-box',
                        marginBottom: '8px',
                      }}
                    />
                    <div style={{ fontSize: '10px', color: '#667788', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Meddelande</div>
                    <textarea
                      value={editBody}
                      onChange={e => setEditBody(e.target.value)}
                      style={{
                        background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px', padding: '7px 10px', color: '#ECF0F1',
                        fontSize: '12px', width: '100%', outline: 'none', boxSizing: 'border-box',
                        resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5',
                        minHeight: '160px', marginBottom: '10px',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                      <button
                        onClick={handleCopyEmail}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                          background: copied ? 'rgba(46,204,113,0.15)' : 'rgba(24,95,165,0.15)',
                          border: `1px solid ${copied ? 'rgba(46,204,113,0.4)' : 'rgba(24,95,165,0.4)'}`,
                          borderRadius: '6px', padding: '7px', color: copied ? '#2ECC71' : '#185FA5',
                          fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {copied ? <><Check size={12} /> Kopieret!</> : <><Copy size={12} /> Kopier email</>}
                      </button>
                      <button
                        onClick={handleSaveEmail}
                        disabled={savingEmail}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '6px', padding: '7px', color: '#ECF0F1',
                          fontSize: '12px', cursor: 'pointer',
                        }}
                      >
                        {savingEmail ? 'Gemmer...' : 'Gem ændringer'}
                      </button>
                    </div>
                    <div style={{ fontSize: '10px', color: '#445566', textAlign: 'center' }}>
                      Åbn Gmail og indsæt manuelt
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#445566', fontSize: '12px' }}>
                    Ingen e-mail genereret endnu — kør outreach-agenten fra CRM
                  </div>
                )}
              </div>

              {/* Outreach status actions */}
              <div style={{ ...card, border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#AAB8C2', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Send size={11} /> Outreach status
                </div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  <button
                    onClick={handleMarkSent}
                    disabled={lead.status === 'contacted'}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                      background: lead.status === 'contacted' ? 'rgba(46,204,113,0.12)' : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${lead.status === 'contacted' ? 'rgba(46,204,113,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '6px', padding: '7px',
                      color: lead.status === 'contacted' ? '#2ECC71' : '#ECF0F1',
                      fontSize: '12px', cursor: lead.status === 'contacted' ? 'default' : 'pointer',
                    }}
                  >
                    {lead.status === 'contacted' ? <><Check size={11} /> Sendt</> : 'Marker som sendt'}
                  </button>
                  <button
                    onClick={handleMarkReplied}
                    disabled={lead.status === 'replied'}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                      background: lead.status === 'replied' ? 'rgba(243,156,18,0.12)' : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${lead.status === 'replied' ? 'rgba(243,156,18,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '6px', padding: '7px',
                      color: lead.status === 'replied' ? '#F39C12' : '#ECF0F1',
                      fontSize: '12px', cursor: lead.status === 'replied' ? 'default' : 'pointer',
                    }}
                  >
                    {lead.status === 'replied' ? <><Check size={11} /> Svar modtaget</> : 'Svar modtaget'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========= HISTORIK ========= */}
          {tab === 'Historik' && (
            <div>
              {/* Log call input */}
              <div style={{ ...card, marginBottom: '12px', border: '1px solid rgba(46,204,113,0.15)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#2ECC71', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <PhoneCall size={11} /> Log opkald
                </div>
                <textarea
                  value={callLogText}
                  onChange={e => setCallLogText(e.target.value)}
                  placeholder="Beskriv hvad der skete på opkaldet... AI analyserer og forbereder opfølgning automatisk"
                  style={{ ...textareaStyle, minHeight: '72px' }}
                />
                <button onClick={handleLogCall} disabled={loggingCall || !callLogText.trim()} style={{ width: '100%', background: loggingCall ? 'rgba(46,204,113,0.1)' : '#2ECC71', border: 'none', borderRadius: '6px', padding: '8px', color: loggingCall ? '#2ECC71' : '#0F1923', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                  {loggingCall ? '🤖 Analyserer...' : '📞 Log opkald + generer opfølgning'}
                </button>
              </div>

              {/* Add note */}
              <div style={{ ...card, marginBottom: '12px' }}>
                <div style={sectionLabel}>Tilføj note</div>
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Skriv en note..." style={{ ...textareaStyle, minHeight: '60px' }} />
                <button onClick={handleAddNote} style={{ background: 'rgba(24,95,165,0.2)', border: '1px solid rgba(24,95,165,0.4)', borderRadius: '6px', padding: '6px 14px', color: '#185FA5', fontSize: '12px', cursor: 'pointer' }}>
                  Gem note
                </button>
              </div>

              {/* Timeline */}
              <div style={sectionLabel}>Aktivitetslog</div>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#667788', padding: '30px', fontSize: '13px' }}>Ingen historik endnu</div>
              ) : history.map(item => (
                <div key={item.id} style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', padding: '9px', background: '#1A2A38', borderRadius: '7px', marginBottom: '6px' }}>
                  <HistoryIcon type={item.type} result={item.result} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#ECF0F1', marginBottom: '2px' }}>
                      {item.action || (item.type === 'sequence' ? 'Outreach besked' : item.type === 'note' ? 'Note' : item.type === 'meeting' ? 'Møde' : 'Log')}
                    </div>
                    <div style={{ fontSize: '11px', color: '#667788', lineHeight: 1.5, wordBreak: 'break-word' }}>
                      {item.message || item.details || item.content || '—'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#445566', marginTop: '3px' }}>{timeAgo(item.sort_at || item.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

