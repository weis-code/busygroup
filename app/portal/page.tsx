'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Send, Package, LayoutGrid, MessageSquare, CheckCircle, Calendar, Flag, User } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Customer {
  id: string;
  company: string;
  contact_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  mrr: number;
  contract_start: string | null;
  contract_end: string | null;
  health_score: number;
  portal_email: string | null;
  products: Array<{ id: string; name: string; price: number; type: string; currency: string }>;
}

interface PortalMessage {
  id: string;
  sender_type: string | null;
  portal_sender_name: string | null;
  sender_id: string;
  content: string;
  file_name: string | null;
  file_type: string | null;
  file_data: string | null;
  created_at: string;
}

interface BoardData {
  board: { id: string; name: string; color: string; description: string | null };
  columns: Array<{ id: string; name: string; color: string; position: number }>;
  tasks: Array<{
    id: string; column_id: string; title: string; description: string | null;
    priority: string; due_date: string | null; labels: string; done: boolean;
    assigned_name: string | null;
  }>;
}

interface ProductData {
  owned: Array<{ id: string; name: string; description: string | null; price: number; type: string; currency: string }>;
  available: Array<{ id: string; name: string; description: string | null; price: number; type: string; currency: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysUntil(d: string | null) {
  if (!d) return 999;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
  if (diff === 1) return 'I går';
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  low:    { label: 'Lav',     color: '#4A5568' },
  medium: { label: 'Medium',  color: '#3498DB' },
  high:   { label: 'Høj',     color: '#E67E22' },
  urgent: { label: 'Kritisk', color: '#E84025' },
};

const PRIMARY = '#E84025';

// ─── Component ────────────────────────────────────────────────────────────────
export default function PortalPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'beskeder' | 'projekt' | 'produkter'>('beskeder');

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [products, setProducts] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);

  // Message input
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ name: string; type: string; data: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    const res = await fetch('/api/portal/messages');
    if (res.status === 401) { router.push('/portal/login'); return; }
    if (res.ok) setMessages(await res.json());
  }, [router]);

  useEffect(() => {
    const init = async () => {
      const [meRes, boardRes, productsRes] = await Promise.all([
        fetch('/api/portal/me'),
        fetch('/api/portal/board'),
        fetch('/api/portal/products'),
      ]);
      if (meRes.status === 401) { router.push('/portal/login'); return; }
      if (meRes.ok) setCustomer(await meRes.json());
      if (boardRes.ok) {
        const b = await boardRes.json();
        setBoard(b);
      }
      if (productsRes.ok) setProducts(await productsRes.json());
      await fetchMessages();
      setLoading(false);
    };
    init();
  }, [router, fetchMessages]);

  // Poll messages every 5s
  useEffect(() => {
    pollRef.current = setInterval(fetchMessages, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if ((!text.trim() && !pendingFile) || sending) return;
    setSending(true);
    const body: Record<string, string> = { content: text.trim() };
    if (pendingFile) {
      body.file_name = pendingFile.name;
      body.file_type = pendingFile.type;
      body.file_data = pendingFile.data;
    }
    setText('');
    setPendingFile(null);
    const res = await fetch('/api/portal/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const msg = await res.json();
      setMessages(prev => [...prev, msg]);
    }
    setSending(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Filen er for stor (max 5MB)'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setPendingFile({ name: file.name, type: file.type, data: base64 });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleLogout = async () => {
    await fetch('/api/portal/logout', { method: 'POST' });
    router.push('/portal/login');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#080C12', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#445566' }}>
        Indlæser...
      </div>
    );
  }

  if (!customer) return null;

  const renewDays = daysUntil(customer.contract_end);
  const contractExpired = renewDays <= 0 && customer.contract_end;
  const contractWarning = renewDays > 0 && renewDays <= 60;

  // ─── Tab styles ───────────────────────────────────────────────────────────
  const tabBtn = (t: typeof tab): React.CSSProperties => ({
    flex: 1, padding: '12px 8px', border: 'none', background: 'transparent',
    color: tab === t ? '#ECF0F1' : '#4A5568',
    borderBottom: `2px solid ${tab === t ? PRIMARY : 'transparent'}`,
    fontSize: 13, fontWeight: tab === t ? 600 : 400,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    transition: 'color 0.15s',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#080C12', color: '#ECF0F1', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div style={{ background: '#0C0F14', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(145deg, ${PRIMARY}, #C4331B)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#fff', flexShrink: 0 }}>B</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#ECF0F1' }}>{customer.company}</div>
            <div style={{ fontSize: 10, color: '#445566' }}>Kundeportal</div>
          </div>
        </div>
        <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#445566', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '6px 10px', borderRadius: 6 }}>
          <LogOut size={13} /> Log ud
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

        {/* ── Contract warning ────────────────────────────────────────────── */}
        {(contractExpired || contractWarning) && (
          <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 8, background: contractExpired ? 'rgba(232,64,37,0.12)' : 'rgba(243,156,18,0.1)', border: `1px solid ${contractExpired ? 'rgba(232,64,37,0.3)' : 'rgba(243,156,18,0.25)'}`, color: contractExpired ? '#E84025' : '#F39C12', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            {contractExpired ? '⚠ Din kontrakt er udløbet — kontakt os for fornyelse' : `⏰ Din kontrakt udløber om ${renewDays} dage (${fmt(customer.contract_end)})`}
          </div>
        )}

        {/* ── Stats row ────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          <div style={{ background: '#0F1520', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '16px' }}>
            <div style={{ fontSize: 10, color: '#445566', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Månedlig ydelse</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#2ECC71' }}>{customer.mrr.toLocaleString('da-DK')} DKK</div>
            <div style={{ fontSize: 10, color: '#334455', marginTop: 2 }}>{(customer.mrr * 12).toLocaleString('da-DK')} DKK/år</div>
          </div>
          <div style={{ background: '#0F1520', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '16px' }}>
            <div style={{ fontSize: 10, color: '#445566', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Kontrakt</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: contractExpired ? '#E84025' : '#ECF0F1' }}>{fmt(customer.contract_start)}</div>
            <div style={{ fontSize: 11, color: '#334455', marginTop: 2 }}>til {fmt(customer.contract_end)}</div>
          </div>
          <div style={{ background: '#0F1520', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '16px' }}>
            <div style={{ fontSize: 10, color: '#445566', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Produkter</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1' }}>{customer.products.length}</div>
            <div style={{ fontSize: 10, color: '#334455', marginTop: 2 }}>aktive produkter</div>
          </div>
        </div>

        {/* ── Tab bar ─────────────────────────────────────────────────────── */}
        <div style={{ background: '#0C0F14', borderRadius: '10px 10px 0 0', border: '1px solid rgba(255,255,255,0.07)', borderBottom: 'none', display: 'flex', marginBottom: 0 }}>
          <button onClick={() => setTab('beskeder')} style={tabBtn('beskeder')}>
            <MessageSquare size={14} /> Beskeder
            {messages.filter(m => m.sender_type !== 'customer').length > 0 && (
              <span style={{ fontSize: 10, background: 'rgba(232,64,37,0.2)', color: PRIMARY, borderRadius: 8, padding: '1px 6px', fontWeight: 700 }}>
                {messages.length}
              </span>
            )}
          </button>
          <button onClick={() => setTab('projekt')} style={tabBtn('projekt')}>
            <LayoutGrid size={14} /> Projekt
          </button>
          <button onClick={() => setTab('produkter')} style={tabBtn('produkter')}>
            <Package size={14} /> Produkter
          </button>
        </div>

        {/* ── Tab content ─────────────────────────────────────────────────── */}
        <div style={{ background: '#0C0F14', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '0 0 10px 10px', minHeight: 480 }}>

          {/* ── BESKEDER ────────────────────────────────────────────────────── */}
          {tab === 'beskeder' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: 560 }}>
              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#334455', padding: '60px 0', fontSize: 13 }}>
                    Send en besked for at starte samtalen med vores team 👋
                  </div>
                ) : messages.map((msg, i) => {
                  const isFromUs = msg.sender_type !== 'customer';
                  const prevMsg = messages[i - 1];
                  const showHeader = !prevMsg || prevMsg.sender_type !== msg.sender_type ||
                    (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()) > 300000;
                  const displayName = isFromUs
                    ? (msg.portal_sender_name || 'BusyGroup Team')
                    : customer.company;

                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isFromUs ? 'flex-start' : 'flex-end', marginBottom: showHeader ? 10 : 2 }}>
                      {showHeader && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexDirection: isFromUs ? 'row' : 'row-reverse' }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: isFromUs ? '#2ECC71' : PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff' }}>
                            {displayName[0].toUpperCase()}
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: isFromUs ? '#2ECC71' : PRIMARY }}>{displayName}</span>
                          <span style={{ fontSize: 10, color: '#334455' }}>{formatTime(msg.created_at)}</span>
                        </div>
                      )}

                      {/* File attachment */}
                      {msg.file_data && (
                        <div style={{ maxWidth: '70%', marginBottom: msg.content ? 4 : 0 }}>
                          {msg.file_type?.startsWith('image/') ? (
                            <img src={`data:${msg.file_type};base64,${msg.file_data}`} alt={msg.file_name || 'Billede'} style={{ maxWidth: 280, maxHeight: 200, borderRadius: 8, display: 'block', border: '1px solid rgba(255,255,255,0.08)' }} />
                          ) : (
                            <a href={`data:${msg.file_type};base64,${msg.file_data}`} download={msg.file_name || 'fil'} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#3498DB', background: 'rgba(52,152,219,0.1)', border: '1px solid rgba(52,152,219,0.2)', borderRadius: 6, padding: '5px 10px', textDecoration: 'none' }}>
                              📎 {msg.file_name || 'Download'}
                            </a>
                          )}
                        </div>
                      )}

                      {/* Text bubble */}
                      {msg.content && (
                        <div style={{
                          maxWidth: '70%', padding: '8px 12px', borderRadius: isFromUs ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
                          background: isFromUs ? '#1A2A38' : `rgba(232,64,37,0.15)`,
                          border: `1px solid ${isFromUs ? 'rgba(255,255,255,0.06)' : 'rgba(232,64,37,0.2)'}`,
                          fontSize: 13, color: '#D4E0E8', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>
                          {msg.content}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '12px 16px' }}>
                {pendingFile && (
                  <div style={{ marginBottom: 8, fontSize: 12, color: '#AAB8C2', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ background: 'rgba(52,152,219,0.1)', border: '1px solid rgba(52,152,219,0.2)', borderRadius: 5, padding: '2px 8px' }}>📎 {pendingFile.name}</span>
                    <button onClick={() => setPendingFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#445566', fontSize: 16 }}>×</button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileSelect} />
                  <button onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: pendingFile ? '#3498DB' : '#445566', padding: 4, fontSize: 16, flexShrink: 0 }}>📎</button>
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Skriv en besked til vores team..."
                    rows={1}
                    style={{ flex: 1, background: '#111820', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 12px', color: '#ECF0F1', fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={(!text.trim() && !pendingFile) || sending}
                    style={{ width: 38, height: 38, borderRadius: 8, border: 'none', background: (text.trim() || pendingFile) ? PRIMARY : 'rgba(255,255,255,0.06)', color: (text.trim() || pendingFile) ? '#fff' : '#445566', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  >
                    <Send size={14} />
                  </button>
                </div>
                <div style={{ fontSize: 10, color: '#2A3A4A', marginTop: 5 }}>Enter sender · Shift+Enter ny linje</div>
              </div>
            </div>
          )}

          {/* ── PROJEKT ─────────────────────────────────────────────────────── */}
          {tab === 'projekt' && (
            <div style={{ padding: 20 }}>
              {!board ? (
                <div style={{ textAlign: 'center', color: '#334455', padding: '60px 0', fontSize: 13 }}>
                  Intet projekt oprettet endnu — kontakt os for at komme i gang
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: board.board.color }} />
                    <span style={{ fontWeight: 600, fontSize: 15, color: '#ECF0F1' }}>{board.board.name}</span>
                    <span style={{ fontSize: 11, color: '#445566' }}>{board.tasks.length} opgaver</span>
                  </div>

                  {/* Columns */}
                  <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
                    {board.columns.map(col => {
                      const colTasks = board.tasks.filter(t => t.column_id === col.id);
                      return (
                        <div key={col.id} style={{ minWidth: 220, flexShrink: 0, background: '#111820', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                          {/* Column header */}
                          <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: col.color }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#9AACBA' }}>{col.name}</span>
                            <span style={{ fontSize: 10, color: '#334455', background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '1px 6px', marginLeft: 'auto' }}>{colTasks.length}</span>
                          </div>
                          {/* Tasks */}
                          <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {colTasks.length === 0 ? (
                              <div style={{ fontSize: 11, color: '#2A3A4A', padding: '6px 4px', textAlign: 'center' }}>Tom</div>
                            ) : colTasks.map(task => {
                              const pCfg = PRIORITY_MAP[task.priority] || PRIORITY_MAP.medium;
                              const overdue = task.due_date && daysUntil(task.due_date) < 0;
                              return (
                                <div key={task.id} style={{ background: '#0C0F14', borderRadius: 8, padding: '10px', border: `1px solid ${task.done ? 'rgba(46,204,113,0.15)' : 'rgba(255,255,255,0.05)'}`, opacity: task.done ? 0.6 : 1 }}>
                                  <div style={{ fontSize: 12, fontWeight: 500, color: '#D0DDE8', lineHeight: 1.4, marginBottom: 7, textDecoration: task.done ? 'line-through' : 'none' }}>
                                    {task.done && <CheckCircle size={10} style={{ color: '#2ECC71', marginRight: 5 }} />}
                                    {task.title}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4, background: pCfg.color + '22', color: pCfg.color, textTransform: 'uppercase' }}>
                                      <Flag size={7} style={{ display: 'inline', marginRight: 2 }} />{pCfg.label}
                                    </span>
                                    {task.due_date && (
                                      <span style={{ fontSize: 10, color: overdue ? '#E84025' : '#445566', display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Calendar size={9} />{new Date(task.due_date).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
                                      </span>
                                    )}
                                    {task.assigned_name && (
                                      <span style={{ fontSize: 10, color: '#445566', display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto' }}>
                                        <User size={9} />{task.assigned_name.split(' ')[0]}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── PRODUKTER ───────────────────────────────────────────────────── */}
          {tab === 'produkter' && (
            <div style={{ padding: 20 }}>
              {/* Owned */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, color: '#2ECC71', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle size={12} /> Dine produkter ({products?.owned.length ?? 0})
                </div>
                {!products?.owned.length ? (
                  <div style={{ fontSize: 12, color: '#334455' }}>Ingen produkter endnu</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                    {products.owned.map(p => (
                      <div key={p.id} style={{ background: 'rgba(46,204,113,0.05)', border: '1px solid rgba(46,204,113,0.2)', borderRadius: 10, padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#ECF0F1' }}>{p.name}</span>
                          <span style={{ fontSize: 9, background: 'rgba(46,204,113,0.15)', color: '#2ECC71', borderRadius: 4, padding: '2px 6px', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>Aktiv</span>
                        </div>
                        {p.description && <div style={{ fontSize: 11, color: '#445566', lineHeight: 1.4, marginBottom: 8 }}>{p.description}</div>}
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#2ECC71' }}>
                          {p.price.toLocaleString('da-DK')} {p.currency}{p.type === 'mrr' ? '/md' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Available */}
              {products && products.available.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: '#667788', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Package size={12} /> Tilgængelige tilkøb ({products.available.length})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                    {products.available.map(p => (
                      <div key={p.id} style={{ background: '#0F1520', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#D0DDE8', marginBottom: 6 }}>{p.name}</div>
                        {p.description && <div style={{ fontSize: 11, color: '#334455', lineHeight: 1.4, marginBottom: 8 }}>{p.description}</div>}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#667788' }}>
                            {p.price.toLocaleString('da-DK')} {p.currency}{p.type === 'mrr' ? '/md' : ''}
                          </span>
                          <button
                            onClick={() => { setText(`Hej, jeg er interesseret i at tilkøbe "${p.name}". Kan I hjælpe mig?`); setTab('beskeder'); }}
                            style={{ fontSize: 11, background: `rgba(232,64,37,0.12)`, border: `1px solid rgba(232,64,37,0.3)`, borderRadius: 6, padding: '4px 10px', color: PRIMARY, cursor: 'pointer', fontWeight: 600 }}
                          >
                            Spørg om pris
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Account manager + kontakt ───────────────────────────────────── */}
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: '#0C0F14', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '16px' }}>
            <div style={{ fontSize: 11, color: '#445566', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Jeres kontakt hos os</div>
            <div style={{ fontSize: 13, color: '#ECF0F1', fontWeight: 500 }}>BusyGroup Team</div>
            <div style={{ fontSize: 11, color: '#445566', marginTop: 3 }}>Svar indenfor 1 hverdag</div>
            <button onClick={() => setTab('beskeder')} style={{ marginTop: 10, background: `rgba(232,64,37,0.12)`, border: `1px solid rgba(232,64,37,0.25)`, borderRadius: 6, padding: '6px 14px', color: PRIMARY, fontSize: 12, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              <MessageSquare size={11} /> Send besked
            </button>
          </div>
          {customer.contact_name && (
            <div style={{ background: '#0C0F14', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '16px' }}>
              <div style={{ fontSize: 11, color: '#445566', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Primær kontakt</div>
              <div style={{ fontSize: 13, color: '#ECF0F1', fontWeight: 500 }}>{customer.contact_name}</div>
              {customer.contact_title && <div style={{ fontSize: 11, color: '#445566', marginTop: 2 }}>{customer.contact_title}</div>}
              {customer.contact_email && (
                <a href={`mailto:${customer.contact_email}`} style={{ fontSize: 11, color: '#3498DB', display: 'block', marginTop: 6, textDecoration: 'none' }}>{customer.contact_email}</a>
              )}
              {customer.contact_phone && (
                <a href={`tel:${customer.contact_phone}`} style={{ fontSize: 11, color: '#3498DB', display: 'block', marginTop: 2, textDecoration: 'none' }}>{customer.contact_phone}</a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
