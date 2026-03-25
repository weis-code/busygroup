'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X, ExternalLink, Mail, Phone, Edit3, MessageSquare, Calendar,
  FileText, ArrowRight, ShoppingBag, RefreshCw, Check, SkipForward,
  Pause, StopCircle, PhoneCall, BookOpen, Send, Bot,
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
  brief_ready?: number;
  brief_updated_at?: string;
  followup_draft_ready?: number;
  nurture_active?: number;
  created_at: string;
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

interface Brief {
  call?: {
    opening?: string;
    pain_points?: string[];
    key_questions?: string[];
    objections?: Array<{ objection: string; response: string }>;
    goal?: string;
  };
  email?: {
    subject?: string;
    body?: string;
  };
}

interface OutreachSeq {
  id: string;
  step: number;
  channel: string;
  message: string;
  status: string;
  next_followup_at: string;
  sent_at: string | null;
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

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

const STATUS_BADGE_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  sent: { bg: 'rgba(46,204,113,0.12)', color: '#2ECC71', label: 'Sendt' },
  draft: { bg: 'rgba(243,156,18,0.12)', color: '#F39C12', label: 'Kladde' },
  pending_send: { bg: 'rgba(24,95,165,0.15)', color: '#185FA5', label: 'Klar til send' },
  scheduled: { bg: 'rgba(102,119,136,0.15)', color: '#667788', label: 'Planlagt' },
  skipped: { bg: 'rgba(102,119,136,0.1)', color: '#445566', label: 'Sprunget over' },
  paused: { bg: 'rgba(231,76,60,0.1)', color: '#E74C3C', label: 'Pauseret' },
  stopped: { bg: 'rgba(102,119,136,0.1)', color: '#445566', label: 'Stoppet' },
};

function SeqStatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE_COLORS[status] ?? { bg: 'rgba(102,119,136,0.1)', color: '#667788', label: status };
  return (
    <span style={{ fontSize: '10px', fontWeight: 600, color: s.color, background: s.bg, borderRadius: '4px', padding: '2px 6px' }}>
      {s.label}
    </span>
  );
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
  const [tab, setTab] = useState<'Overblik' | 'Brief' | 'Outreach' | 'Historik'>('Overblik');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Lead>>({});
  const [noteText, setNoteText] = useState('');
  const [callLogText, setCallLogText] = useState('');
  const [loggingCall, setLoggingCall] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [leadProducts, setLeadProducts] = useState<Product[]>([]);

  // Brief state
  const [brief, setBrief] = useState<Brief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefEdit, setBriefEdit] = useState<Brief>({});

  // Outreach state
  const [sequences, setSequences] = useState<OutreachSeq[]>([]);
  const [seqLoading, setSeqLoading] = useState(false);

  const loadHistory = useCallback(() => {
    fetch(`/api/leads/${lead.id}/history`)
      .then(r => r.json())
      .then(data => setHistory(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [lead.id]);

  const loadBrief = useCallback(() => {
    fetch(`/api/leads/${lead.id}/brief`)
      .then(r => r.json())
      .then(data => {
        if (data && data.content) {
          setBrief(data.content as Brief);
          setBriefEdit(data.content as Brief);
        }
      })
      .catch(() => {});
  }, [lead.id]);

  const loadSequences = useCallback(() => {
    fetch(`/api/leads/${lead.id}/outreach`)
      .then(r => r.json())
      .then(data => setSequences(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [lead.id]);

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => setAllProducts(Array.isArray(d) ? d.filter((p: Product) => p.active) : [])).catch(() => {});
    fetch(`/api/leads/${lead.id}/products`).then(r => r.json()).then(d => setLeadProducts(Array.isArray(d) ? d : [])).catch(() => {});
    loadHistory();
    loadBrief();
    loadSequences();
  }, [lead.id, loadHistory, loadBrief, loadSequences]);

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

  const handleLogCall = async () => {
    if (!callLogText.trim()) return;
    setLoggingCall(true);
    try {
      const res = await fetch('/api/agents/dk-calllog/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, message: callLogText }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Opkald logget — AI analyserer og forbereder opfølgning');
        setCallLogText('');
        loadHistory();
        loadSequences();
        await onUpdate(lead.id, {});
      } else {
        toast.error(data.message || 'Fejl ved logning');
      }
    } catch { toast.error('Fejl ved logning af opkald'); }
    finally { setLoggingCall(false); }
  };

  const handleRegenerateBrief = async () => {
    setBriefLoading(true);
    try {
      const res = await fetch('/api/agents/dk-callprep/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Brief regenereret');
        loadBrief();
      } else {
        toast.error(data.message || 'Fejl');
      }
    } catch { toast.error('Fejl ved regenerering'); }
    finally { setBriefLoading(false); }
  };

  const handleSeqAction = async (seqId: string, action: string, message?: string) => {
    setSeqLoading(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/outreach`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seq_id: seqId, action, message }),
      });
      const updated = await res.json();
      setSequences(Array.isArray(updated) ? updated : []);
      if (action === 'approve') toast.success('Godkendt og markeret som sendt');
      else if (action === 'skip') toast.success('Trin sprunget over');
      else if (action === 'pause') toast.success('Sekvens pauseret');
      else if (action === 'stop') toast.success('Sekvens stoppet');
    } catch { toast.error('Fejl'); }
    finally { setSeqLoading(false); }
  };

  const nextIdx = STATUS_ORDER.indexOf(lead.status) + 1;
  const nextSt = nextIdx < STATUS_ORDER.length ? STATUS_ORDER[nextIdx] : null;
  const isDK = lead.market === 'denmark';

  const pendingSeqs = sequences.filter(s => ['draft', 'pending_send'].includes(s.status));
  const scheduledSeqs = sequences.filter(s => s.status === 'scheduled');
  const sentSeqs = sequences.filter(s => ['sent', 'replied'].includes(s.status));
  const activeSeq = sequences.some(s => ['draft', 'pending_send', 'scheduled'].includes(s.status));

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
            <button onClick={() => { setEditing(!editing); if (!editing) setEditData({ ...lead }); }} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '5px 10px', color: '#ECF0F1', fontSize: '11px', cursor: 'pointer' }}>
              <Edit3 size={11} /> {editing ? 'Annuller' : 'Rediger'}
            </button>
          </div>

          {/* Agent-status strip (DK only) */}
          {isDK && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
              <span
                onClick={() => setTab('Brief')}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', cursor: 'pointer', color: lead.brief_ready ? '#2ECC71' : '#667788' }}
              >
                <BookOpen size={10} />
                {lead.brief_ready ? `Brief klar (${timeAgo(lead.brief_updated_at || '')})` : 'Intet brief endnu'}
              </span>
              {lead.followup_draft_ready ? (
                <span onClick={() => setTab('Outreach')} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#F39C12', cursor: 'pointer' }}>
                  <Bot size={10} /> Opfølgning klar til godkendelse
                </span>
              ) : null}
              {lead.nurture_active ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#185FA5' }}>
                  <Send size={10} /> Nurture-sekvens aktiv
                </span>
              ) : null}
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          {(['Overblik', ...(isDK ? ['Brief', 'Outreach'] : []), 'Historik'] as const).map(t => (
            <button key={t} onClick={() => setTab(t as typeof tab)} style={{
              flex: 1, padding: '9px 4px', border: 'none', background: 'transparent',
              color: tab === t ? '#ECF0F1' : '#667788',
              borderBottom: `2px solid ${tab === t ? '#185FA5' : 'transparent'}`,
              fontSize: '12px', fontWeight: tab === t ? 600 : 400, cursor: 'pointer', position: 'relative',
            }}>
              {t}
              {t === 'Brief' && lead.brief_ready ? <span style={{ position: 'absolute', top: '6px', right: '6px', width: '6px', height: '6px', borderRadius: '50%', background: '#2ECC71' }} /> : null}
              {t === 'Outreach' && pendingSeqs.length > 0 ? <span style={{ position: 'absolute', top: '6px', right: '6px', width: '6px', height: '6px', borderRadius: '50%', background: '#F39C12' }} /> : null}
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

          {/* ========= BRIEF ========= */}
          {tab === 'Brief' && isDK && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#ECF0F1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BookOpen size={13} style={{ color: '#185FA5' }} /> Call & Email Brief
                </h3>
                <button onClick={handleRegenerateBrief} disabled={briefLoading} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(24,95,165,0.15)', border: '1px solid rgba(24,95,165,0.3)', borderRadius: '6px', padding: '5px 10px', color: '#185FA5', fontSize: '11px', cursor: 'pointer' }}>
                  <RefreshCw size={11} className={briefLoading ? 'spin' : ''} /> {briefLoading ? 'Genererer...' : 'Regenerer brief'}
                </button>
              </div>

              {!brief ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#667788' }}>
                  <Bot size={28} style={{ marginBottom: '10px', opacity: 0.4 }} />
                  <div style={{ fontSize: '13px' }}>Ingen brief endnu</div>
                  <button onClick={handleRegenerateBrief} style={{ marginTop: '12px', background: '#185FA5', border: 'none', borderRadius: '6px', padding: '8px 16px', color: '#ECF0F1', fontSize: '12px', cursor: 'pointer' }}>
                    Generer nu
                  </button>
                </div>
              ) : (
                <>
                  {/* CALL BRIEF */}
                  <div style={{ ...card, border: '1px solid rgba(24,95,165,0.2)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#185FA5', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <PhoneCall size={12} /> OPKALDSBRIEF
                    </div>

                    <div style={sectionLabel}>Åbning</div>
                    <textarea
                      value={briefEdit.call?.opening || ''}
                      onChange={e => setBriefEdit(p => ({ ...p, call: { ...p.call, opening: e.target.value } }))}
                      style={{ ...textareaStyle, minHeight: '60px', marginBottom: '12px' }}
                    />

                    <div style={sectionLabel}>Smertepunkter</div>
                    <div style={{ marginBottom: '12px' }}>
                      {(briefEdit.call?.pain_points || []).map((pp, i) => (
                        <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '5px', alignItems: 'flex-start' }}>
                          <span style={{ color: '#E74C3C', fontSize: '12px', flexShrink: 0, marginTop: '2px' }}>·</span>
                          <input value={pp} onChange={e => {
                            const updated = [...(briefEdit.call?.pain_points || [])];
                            updated[i] = e.target.value;
                            setBriefEdit(p => ({ ...p, call: { ...p.call, pain_points: updated } }));
                          }} style={{ ...inputStyle, marginBottom: 0 }} />
                        </div>
                      ))}
                    </div>

                    <div style={sectionLabel}>Nøglespørgsmål</div>
                    <div style={{ marginBottom: '12px' }}>
                      {(briefEdit.call?.key_questions || []).map((q, i) => (
                        <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '5px', alignItems: 'flex-start' }}>
                          <span style={{ color: '#185FA5', fontSize: '11px', flexShrink: 0, marginTop: '4px', fontWeight: 700 }}>{i + 1}.</span>
                          <input value={q} onChange={e => {
                            const updated = [...(briefEdit.call?.key_questions || [])];
                            updated[i] = e.target.value;
                            setBriefEdit(p => ({ ...p, call: { ...p.call, key_questions: updated } }));
                          }} style={{ ...inputStyle, marginBottom: 0 }} />
                        </div>
                      ))}
                    </div>

                    <div style={sectionLabel}>Indvendinger & svar</div>
                    <div style={{ marginBottom: '12px' }}>
                      {(briefEdit.call?.objections || []).map((obj, i) => (
                        <div key={i} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '8px', marginBottom: '6px' }}>
                          <div style={{ fontSize: '11px', color: '#F39C12', fontWeight: 600, marginBottom: '4px' }}>
                            &ldquo;{obj.objection}&rdquo;
                          </div>
                          <textarea value={obj.response} onChange={e => {
                            const updated = [...(briefEdit.call?.objections || [])];
                            updated[i] = { ...updated[i], response: e.target.value };
                            setBriefEdit(p => ({ ...p, call: { ...p.call, objections: updated } }));
                          }} style={{ ...textareaStyle, minHeight: '48px', marginBottom: 0 }} />
                        </div>
                      ))}
                    </div>

                    <div style={sectionLabel}>Mål for opkaldet</div>
                    <textarea value={briefEdit.call?.goal || ''} onChange={e => setBriefEdit(p => ({ ...p, call: { ...p.call, goal: e.target.value } }))} style={{ ...textareaStyle, minHeight: '48px', marginBottom: 0 }} />
                  </div>

                  {/* EMAIL BRIEF */}
                  <div style={{ ...card, border: '1px solid rgba(46,204,113,0.15)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#2ECC71', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Mail size={12} /> EMAIL BRIEF
                    </div>

                    <div style={sectionLabel}>Emne</div>
                    <input value={briefEdit.email?.subject || ''} onChange={e => setBriefEdit(p => ({ ...p, email: { ...p.email, subject: e.target.value } }))} style={inputStyle} />

                    <div style={sectionLabel}>Udkast</div>
                    <textarea value={briefEdit.email?.body || ''} onChange={e => setBriefEdit(p => ({ ...p, email: { ...p.email, body: e.target.value } }))} style={{ ...textareaStyle, minHeight: '130px', marginBottom: '10px' }} />

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {lead.email && (
                        <a href={`mailto:${lead.email}?subject=${encodeURIComponent(briefEdit.email?.subject || '')}&body=${encodeURIComponent(briefEdit.email?.body || '')}`}
                          style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1, background: '#185FA5', borderRadius: '6px', padding: '8px 12px', color: '#ECF0F1', fontSize: '12px', textDecoration: 'none', justifyContent: 'center', fontWeight: 500 }}>
                          <Check size={12} /> Godkend og åbn i mail
                        </a>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ========= OUTREACH ========= */}
          {tab === 'Outreach' && isDK && (
            <div>
              {/* Sequence status */}
              <div style={{ ...card, marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#ECF0F1', marginBottom: '3px' }}>Aktiv sekvens</div>
                    <div style={{ fontSize: '11px', color: '#667788' }}>
                      {activeSeq ? `${sequences.filter(s => s.status === 'sent').length} af ${sequences.length} trin sendt` : 'Ingen aktiv sekvens'}
                    </div>
                  </div>
                  {activeSeq && (
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button disabled={seqLoading} onClick={() => handleSeqAction('', 'pause')} style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(243,156,18,0.1)', border: '1px solid rgba(243,156,18,0.25)', borderRadius: '5px', padding: '4px 8px', color: '#F39C12', fontSize: '11px', cursor: 'pointer' }}>
                        <Pause size={10} /> Pause
                      </button>
                      <button disabled={seqLoading} onClick={() => handleSeqAction('', 'stop')} style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.25)', borderRadius: '5px', padding: '4px 8px', color: '#E74C3C', fontSize: '11px', cursor: 'pointer' }}>
                        <StopCircle size={10} /> Stop
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Pending approval */}
              {pendingSeqs.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '11px', color: '#F39C12', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Bot size={11} /> {pendingSeqs.length} afventer din godkendelse
                  </div>
                  {pendingSeqs.map(seq => (
                    <PendingSeqCard key={seq.id} seq={seq} onAction={handleSeqAction} loading={seqLoading} />
                  ))}
                </div>
              )}

              {/* Scheduled */}
              {scheduledSeqs.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={sectionLabel}>Planlagte trin</div>
                  {scheduledSeqs.map(seq => (
                    <div key={seq.id} style={{ ...card, marginBottom: '6px', opacity: 0.7 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span style={{ fontSize: '11px', color: '#AAB8C2' }}>Trin {seq.step} · {seq.channel === 'linkedin' ? 'LinkedIn' : 'Email'}</span>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span style={{ fontSize: '10px', color: '#667788' }}>{formatDate(seq.next_followup_at)}</span>
                          <SeqStatusBadge status={seq.status} />
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', color: '#667788', lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: '60px', overflow: 'hidden' }}>
                        {seq.message.slice(0, 120)}{seq.message.length > 120 ? '…' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Sent history */}
              {sentSeqs.length > 0 && (
                <div>
                  <div style={sectionLabel}>Sendt historik</div>
                  {sentSeqs.map(seq => (
                    <div key={seq.id} style={{ ...card, marginBottom: '6px', opacity: 0.6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#AAB8C2' }}>Trin {seq.step} · {seq.channel === 'linkedin' ? 'LinkedIn' : 'Email'}</span>
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                          <span style={{ fontSize: '10px', color: '#667788' }}>{seq.sent_at ? formatDate(seq.sent_at) : '—'}</span>
                          <SeqStatusBadge status={seq.status} />
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', color: '#667788', lineHeight: 1.4, maxHeight: '40px', overflow: 'hidden' }}>
                        {seq.message.slice(0, 100)}{seq.message.length > 100 ? '…' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {sequences.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#667788' }}>
                  <MessageSquare size={28} style={{ marginBottom: '10px', opacity: 0.4 }} />
                  <div style={{ fontSize: '13px' }}>Ingen outreach endnu</div>
                  <div style={{ fontSize: '11px', marginTop: '4px' }}>Nurture-agenten genererer en sekvens automatisk</div>
                </div>
              )}
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

// ── Pending Seq Card ──
function PendingSeqCard({ seq, onAction, loading }: {
  seq: OutreachSeq;
  onAction: (id: string, action: string, message?: string) => void;
  loading: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState(seq.message);

  return (
    <div style={{ background: 'rgba(243,156,18,0.06)', border: '1px solid rgba(243,156,18,0.2)', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#ECF0F1' }}>Trin {seq.step} · {seq.channel === 'linkedin' ? '💼 LinkedIn' : '📧 Email'}</span>
          {seq.next_followup_at && <span style={{ fontSize: '10px', color: '#667788', marginLeft: '8px' }}>{formatDate(seq.next_followup_at)}</span>}
        </div>
        <SeqStatusBadge status={seq.status} />
      </div>

      {editing ? (
        <textarea value={msg} onChange={e => setMsg(e.target.value)} style={{ background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px', color: '#ECF0F1', fontSize: '12px', width: '100%', minHeight: '100px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: '1.5', marginBottom: '8px' }} />
      ) : (
        <div style={{ fontSize: '12px', color: '#AAB8C2', lineHeight: 1.5, whiteSpace: 'pre-wrap', marginBottom: '8px', maxHeight: '120px', overflowY: 'auto' }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px' }}>
        <button disabled={loading} onClick={() => { if (editing) { onAction(seq.id, 'edit', msg); setEditing(false); } onAction(seq.id, 'approve'); }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: '#2ECC71', border: 'none', borderRadius: '5px', padding: '6px', color: '#0F1923', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
          <Check size={11} /> Godkend
        </button>
        <button disabled={loading} onClick={() => setEditing(!editing)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px', padding: '6px', color: '#ECF0F1', fontSize: '11px', cursor: 'pointer' }}>
          <Edit3 size={11} /> {editing ? 'Annuller' : 'Rediger'}
        </button>
        <button disabled={loading} onClick={() => onAction(seq.id, 'skip')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'rgba(102,119,136,0.1)', border: '1px solid rgba(102,119,136,0.2)', borderRadius: '5px', padding: '6px 8px', color: '#667788', fontSize: '11px', cursor: 'pointer' }}>
          <SkipForward size={11} />
        </button>
      </div>
    </div>
  );
}
