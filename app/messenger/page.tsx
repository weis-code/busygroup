'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Send, Plus, MessageSquare, Hash, X, Check, Search,
  Settings, Zap,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  created_at: string;
  last_message: string | null;
  last_message_at: string | null;
  last_sender_name: string | null;
  unread_count: number;
  other_members: Array<{ id: string; name: string }> | null;
  customer_id: string | null;
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_type: string | null;
  portal_sender_name: string | null;
  content: string;
  file_name: string | null;
  file_type: string | null;
  file_data: string | null;
  created_at: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMsgTime(iso: string) {
  return new Date(iso).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'I DAG';
  if (diff === 1) return 'I GÅR';
  return d.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
}

function isSameDay(a: string, b: string) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ['#E84025', '#2ECC71', '#9B59B6', '#1ABC9C', '#F39C12', '#E91E63'];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function convDisplayName(conv: Conversation): string {
  if (conv.type === 'group') return conv.name || 'Gruppe';
  if (conv.other_members && conv.other_members.length > 0)
    return conv.other_members.map(m => m.name).join(', ');
  return 'Samtale';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MessengerPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // New conversation modal
  const [showNew, setShowNew] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isGroup, setIsGroup] = useState(false);
  const [creating, setCreating] = useState(false);

  const [me, setMe] = useState<{ id: string; name: string } | null>(null);

  // File attachment
  const [pendingFile, setPendingFile] = useState<{ name: string; type: string; data: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMe = useCallback(async () => {
    const res = await fetch('/api/auth/me');
    if (res.ok) setMe(await res.json());
  }, []);

  const fetchConversations = useCallback(async () => {
    const res = await fetch('/api/chat');
    if (res.ok) setConversations(await res.json());
    setLoading(false);
  }, []);

  const fetchMessages = useCallback(async (convId: string) => {
    const res = await fetch(`/api/chat/${convId}`);
    if (res.ok) {
      setMessages(await res.json());
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c));
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    const res = await fetch('/api/users');
    if (res.ok) setAllUsers(await res.json());
  }, []);

  useEffect(() => { fetchMe(); fetchConversations(); }, [fetchMe, fetchConversations]);

  // Poll every 3s
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      fetchConversations();
      if (selectedId) fetchMessages(selectedId);
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedId, fetchConversations, fetchMessages]);

  useEffect(() => {
    if (selectedId) fetchMessages(selectedId);
  }, [selectedId, fetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if ((!text.trim() && !pendingFile) || !selectedId || sending) return;
    const content = text.trim();
    setSending(true);
    setText('');
    const fileToSend = pendingFile;
    setPendingFile(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const body: Record<string, string> = { content };
    if (fileToSend) {
      body.file_name = fileToSend.name;
      body.file_type = fileToSend.type;
      body.file_data = fileToSend.data;
    }

    const res = await fetch(`/api/chat/${selectedId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const msg = await res.json();
      setMessages(prev => [...prev, msg]);
      setConversations(prev => prev.map(c =>
        c.id === selectedId
          ? { ...c, last_message: msg.content || '📎 Fil', last_message_at: msg.created_at, last_sender_name: msg.sender_name }
          : c
      ));
    }
    setSending(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Filen er for stor (max 5MB)'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      setPendingFile({ name: file.name, type: file.type, data: base64 });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCreateConv = async () => {
    if (selectedUsers.length === 0) return;
    setCreating(true);
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: isGroup || selectedUsers.length > 1 ? 'group' : 'direct',
        name: isGroup && groupName ? groupName : null,
        memberIds: selectedUsers,
      }),
    });
    if (res.ok) {
      const conv = await res.json();
      await fetchConversations();
      setSelectedId(conv.id);
      setShowNew(false);
      setSelectedUsers([]);
      setGroupName('');
    }
    setCreating(false);
  };

  const selectedConv = conversations.find(c => c.id === selectedId);
  // Split conversations — customer portal threads get their own section
  const customerThreads = conversations.filter(c => c.customer_id);
  const groups = conversations.filter(c => c.type === 'group' && !c.customer_id);
  const directs = conversations.filter(c => c.type === 'direct');

  const filterConv = (list: Conversation[]) =>
    list.filter(c => !search || convDisplayName(c).toLowerCase().includes(search.toLowerCase()));

  // ─── Sidebar item ──────────────────────────────────────────────────────────
  const SidebarItem = ({ conv }: { conv: Conversation }) => {
    const isSelected = selectedId === conv.id;
    const hasUnread = Number(conv.unread_count) > 0;
    const name = convDisplayName(conv);
    const isGroup = conv.type === 'group';

    return (
      <button
        onClick={() => setSelectedId(conv.id)}
        style={{
          width: '100%', textAlign: 'left', padding: '5px 10px 5px 12px',
          border: 'none', cursor: 'pointer',
          background: isSelected ? 'rgba(255,255,255,0.1)' : 'transparent',
          borderRadius: '6px',
          display: 'flex', gap: '8px', alignItems: 'center',
          transition: 'background 0.1s', marginBottom: '1px',
        }}
      >
        {isGroup ? (
          <span style={{ fontSize: '14px', color: isSelected ? '#ECF0F1' : '#8899AA', fontWeight: hasUnread ? 700 : 400 }}>
            # {name}
          </span>
        ) : (
          <>
            <div style={{
              width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
              background: avatarColor(name),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 800, color: '#fff',
            }}>
              {initials(name)}
            </div>
            <span style={{
              flex: 1, fontSize: '13px', color: isSelected ? '#ECF0F1' : '#8899AA',
              fontWeight: hasUnread ? 700 : 400,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {name}
            </span>
          </>
        )}
        {hasUnread && (
          <span style={{
            minWidth: '18px', height: '18px', borderRadius: '9px',
            background: '#E84025', fontSize: '10px', fontWeight: 700,
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', flexShrink: 0,
          }}>
            {conv.unread_count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)', background: '#0C1118', overflow: 'hidden' }}>

      {/* ── Venstre sidebar: Slack-style ──────────────────────────────────── */}
      <div style={{
        width: '240px', flexShrink: 0,
        background: '#0F1621',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Workspace header */}
        <div style={{
          padding: '14px 16px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#ECF0F1' }}>BusyConsulting</div>
          </div>
          <button
            onClick={() => { setShowNew(true); fetchUsers(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8899AA', padding: '4px' }}
            title="Ny samtale"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '8px 10px' }}>
          <div style={{
            background: 'rgba(255,255,255,0.07)', borderRadius: '6px',
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '5px 10px', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <Search size={12} color="#556677" />
            <input
              placeholder="Søg samtaler..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: 'none', border: 'none', outline: 'none',
                color: '#AAB8C2', fontSize: '12px', width: '100%',
              }}
            />
          </div>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 16px' }}>

          {/* Kanaler */}
          <div style={{ marginTop: '8px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 8px 4px 10px', marginBottom: '2px',
            }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#556677', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Kanaler
              </span>
              <button
                onClick={() => { setIsGroup(true); setShowNew(true); fetchUsers(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#556677', padding: '2px' }}
              >
                <Plus size={13} />
              </button>
            </div>
            {loading ? (
              <div style={{ padding: '8px 12px', fontSize: '12px', color: '#445566' }}>Indlæser...</div>
            ) : filterConv(groups).length === 0 ? (
              <div style={{ padding: '4px 12px', fontSize: '12px', color: '#445566' }}>Ingen kanaler</div>
            ) : (
              filterConv(groups).map(conv => <SidebarItem key={conv.id} conv={conv} />)
            )}
          </div>

          {/* Direkte beskeder */}
          <div style={{ marginTop: '16px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 8px 4px 10px', marginBottom: '2px',
            }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#556677', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Direkte
              </span>
              <button
                onClick={() => { setIsGroup(false); setShowNew(true); fetchUsers(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#556677', padding: '2px' }}
              >
                <Plus size={13} />
              </button>
            </div>
            {filterConv(directs).length === 0 ? (
              <div style={{ padding: '4px 12px', fontSize: '12px', color: '#445566' }}>Ingen direkte beskeder</div>
            ) : (
              filterConv(directs).map(conv => <SidebarItem key={conv.id} conv={conv} />)
            )}
          </div>

          {/* Kunder — portal-tråde */}
          {customerThreads.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ padding: '4px 8px 4px 10px', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#E84025', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Kunder
                </span>
                <span style={{ fontSize: '9px', background: 'rgba(232,64,37,0.15)', color: '#E84025', borderRadius: 8, padding: '1px 5px', fontWeight: 700 }}>
                  Portal
                </span>
              </div>
              {filterConv(customerThreads).map(conv => <SidebarItem key={conv.id} conv={conv} />)}
            </div>
          )}
        </div>

        {/* Bund: bruger-info */}
        {me && (
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
              background: avatarColor(me.name),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 800, color: '#fff',
              position: 'relative',
            }}>
              {initials(me.name)}
              {/* Online dot */}
              <div style={{
                position: 'absolute', bottom: '-1px', right: '-1px',
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#2ECC71', border: '1.5px solid #0F1621',
              }} />
            </div>
            <span style={{ fontSize: '13px', color: '#AAB8C2', fontWeight: 500 }}>{me.name}</span>
          </div>
        )}
      </div>

      {/* ── Højre: chat ───────────────────────────────────────────────────── */}
      {selectedConv ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

          {/* Header */}
          <div style={{
            padding: '0 20px',
            height: '50px', flexShrink: 0,
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#0C1118',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {selectedConv.type === 'group' ? (
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#ECF0F1' }}>
                  # {convDisplayName(selectedConv)}
                </span>
              ) : (
                <>
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '6px',
                    background: avatarColor(convDisplayName(selectedConv)),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 800, color: '#fff',
                  }}>
                    {initials(convDisplayName(selectedConv))}
                  </div>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#ECF0F1' }}>
                    {convDisplayName(selectedConv)}
                  </span>
                </>
              )}
              {selectedConv.type === 'group' && selectedConv.other_members && (
                <span style={{ fontSize: '12px', color: '#445566' }}>
                  {selectedConv.other_members.length + 1} medlemmer
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#445566', padding: '6px' }}><Search size={15} /></button>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#445566', padding: '6px' }}><Zap size={15} /></button>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#445566', padding: '6px' }}><Settings size={15} /></button>
            </div>
          </div>

          {/* Beskeder — scrollable */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 20px 0',
            display: 'flex', flexDirection: 'column',
          }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#334455', padding: '60px 0', fontSize: '13px' }}>
                {selectedConv.type === 'group'
                  ? `Velkommen til # ${convDisplayName(selectedConv)} 👋`
                  : `Start en samtale med ${convDisplayName(selectedConv)}`}
              </div>
            ) : (
              <>
                {messages.map((msg, i) => {
                  const isMe = me && msg.sender_id === me.id;
                  const prevMsg = messages[i - 1];
                  const nextMsg = messages[i + 1];
                  const showDate = !prevMsg || !isSameDay(prevMsg.created_at, msg.created_at);
                  const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id || showDate;
                  const isLastInGroup = !nextMsg || nextMsg.sender_id !== msg.sender_id;
                  const color = avatarColor(msg.sender_name);

                  return (
                    <div key={msg.id}>
                      {/* Dato-separator */}
                      {showDate && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          margin: '16px 0 12px',
                        }}>
                          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
                          <span style={{ fontSize: '11px', color: '#445566', fontWeight: 600, letterSpacing: '0.05em' }}>
                            {formatDateSeparator(msg.created_at)}
                          </span>
                          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
                        </div>
                      )}

                      {/* Besked */}
                      {(() => {
                        const isPortalMsg = msg.sender_type === 'customer';
                        const displayName = isPortalMsg ? (msg.portal_sender_name || 'Kunde') : msg.sender_name;
                        const avatarBg = isPortalMsg ? '#E84025' : color;
                        return (
                        <div style={{
                          display: 'flex', gap: '10px', alignItems: 'flex-start',
                          marginBottom: isLastInGroup ? '12px' : '2px',
                          paddingTop: showAvatar ? '4px' : '0',
                        }}>
                          {/* Avatar */}
                          <div style={{ width: '36px', flexShrink: 0 }}>
                            {showAvatar && (
                              <div style={{
                                width: '36px', height: '36px', borderRadius: '8px',
                                background: avatarBg,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '13px', fontWeight: 800, color: '#fff',
                                position: 'relative',
                              }}>
                                {initials(displayName)}
                                {isPortalMsg && (
                                  <div style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: '#E84025', border: '2px solid #0C1118', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 6 }}>P</div>
                                )}
                              </div>
                            )}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            {showAvatar && (
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '3px' }}>
                                <span style={{ fontSize: '14px', fontWeight: 700, color: isPortalMsg ? '#E84025' : (isMe ? '#ECF0F1' : color) }}>
                                  {displayName}
                                </span>
                                {isPortalMsg && (
                                  <span style={{ fontSize: '9px', color: '#E84025', background: 'rgba(232,64,37,0.12)', padding: '1px 5px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase' }}>Kunde</span>
                                )}
                                <span style={{ fontSize: '11px', color: '#445566' }}>{formatMsgTime(msg.created_at)}</span>
                              </div>
                            )}

                            {/* Fil-vedhæftning */}
                            {msg.file_data && (
                              <div style={{ marginBottom: msg.content ? '6px' : 0 }}>
                                {msg.file_type?.startsWith('image/') ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={`data:${msg.file_type};base64,${msg.file_data}`}
                                    alt={msg.file_name || 'Billede'}
                                    style={{ maxWidth: 320, maxHeight: 240, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', display: 'block' }}
                                  />
                                ) : (
                                  <a
                                    href={`data:${msg.file_type};base64,${msg.file_data}`}
                                    download={msg.file_name || 'fil'}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#3498DB', background: 'rgba(52,152,219,0.1)', border: '1px solid rgba(52,152,219,0.2)', borderRadius: 6, padding: '5px 10px', textDecoration: 'none' }}
                                  >
                                    📎 {msg.file_name || 'Download fil'}
                                  </a>
                                )}
                              </div>
                            )}

                            {/* Besked-indhold */}
                            {msg.content && (
                              <div style={{ fontSize: '14px', color: '#D4E0E8', lineHeight: '1.55', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {msg.content}
                              </div>
                            )}
                          </div>
                        </div>
                        );
                      })()}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} style={{ height: '16px' }} />
              </>
            )}
          </div>

          {/* ── Input — altid i bunden ──────────────────────────────────── */}
          <div style={{
            flexShrink: 0,
            padding: '12px 20px 16px',
            background: '#0C1118',
          }}>
            <div style={{
              background: '#1A2535',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              overflow: 'hidden',
            }}>
              {/* Toolbar */}
              <div style={{
                padding: '8px 12px 0',
                display: 'flex', gap: '6px', alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                paddingBottom: '6px',
              }}>
                {[
                  { label: 'B', style: { fontWeight: 700 } },
                  { label: '/', style: { fontStyle: 'italic' } },
                  { label: '🔗', style: {} },
                  { label: '{ }', style: { fontFamily: 'monospace', fontSize: '11px' } },
                  { label: '~~', style: { textDecoration: 'line-through' } },
                  { label: '😊', style: {} },
                ].map((btn, i) => (
                  <button key={i} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#556677', fontSize: '13px', padding: '2px 5px', borderRadius: '4px',
                    ...btn.style,
                  }}>
                    {btn.label}
                  </button>
                ))}
                <div style={{ flex: 1 }} />
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#556677' }}>
                  <Zap size={13} />
                </button>
              </div>

              {/* Pending file preview */}
              {pendingFile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 0', fontSize: 12, color: '#AAB8C2' }}>
                  <span style={{ background: 'rgba(52,152,219,0.12)', border: '1px solid rgba(52,152,219,0.2)', borderRadius: 5, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 5 }}>
                    📎 {pendingFile.name}
                  </span>
                  <button onClick={() => setPendingFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#445566', padding: 2 }}>
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Textarea */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '8px 12px' }}>
                {/* Hidden file input */}
                <input ref={fileInputRef} type="file" accept="*/*" onChange={handleFileSelect} style={{ display: 'none' }} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Vedhæft fil"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: pendingFile ? '#3498DB' : '#445566', padding: '4px', display: 'flex', flexShrink: 0 }}
                >
                  📎
                </button>
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={e => {
                    setText(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={`Besked til ${selectedConv.type === 'group' ? '#' : ''}${convDisplayName(selectedConv)}...`}
                  rows={1}
                  style={{
                    flex: 1, background: 'transparent', border: 'none',
                    color: '#ECF0F1', fontSize: '14px', outline: 'none',
                    resize: 'none', lineHeight: '1.5', fontFamily: 'inherit',
                    minHeight: '22px', maxHeight: '160px', overflowY: 'auto',
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={(!text.trim() && !pendingFile) || sending}
                  style={{
                    width: 34, height: 34, borderRadius: '7px', border: 'none', flexShrink: 0,
                    background: (text.trim() || pendingFile) && !sending ? '#E84025' : 'rgba(255,255,255,0.06)',
                    color: (text.trim() || pendingFile) && !sending ? '#fff' : '#445566',
                    cursor: (text.trim() || pendingFile) && !sending ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s', fontSize: '12px', fontWeight: 600, gap: '4px',
                  }}
                >
                  <Send size={13} />
                </button>
              </div>
            </div>
            <div style={{ fontSize: '10px', color: '#334455', marginTop: '5px', paddingLeft: '2px' }}>
              Enter sender · Shift+Enter ny linje
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: '#334455', gap: '10px', background: '#0C1118',
        }}>
          <MessageSquare size={48} style={{ opacity: 0.12 }} />
          <div style={{ fontSize: '16px', color: '#445566', fontWeight: 600 }}>Vælg en samtale</div>
          <div style={{ fontSize: '13px', color: '#334455' }}>eller start en ny med + knappen</div>
        </div>
      )}

      {/* ── Modal: Ny samtale ────────────────────────────────────────────── */}
      {showNew && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowNew(false); }}
        >
          <div style={{
            background: '#111E2A', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px', padding: '24px', width: '420px',
            maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: '#ECF0F1', fontWeight: 700 }}>
                Ny samtale
              </h3>
              <button onClick={() => setShowNew(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#445566' }}>
                <X size={16} />
              </button>
            </div>

            {/* Type */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setIsGroup(false)}
                style={{
                  flex: 1, padding: '8px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  background: !isGroup ? 'rgba(232,64,37,0.2)' : 'rgba(255,255,255,0.05)',
                  color: !isGroup ? '#E84025' : '#556677', fontSize: '12px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                }}
              >
                <MessageSquare size={13} /> Direkte besked
              </button>
              <button
                onClick={() => setIsGroup(true)}
                style={{
                  flex: 1, padding: '8px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  background: isGroup ? 'rgba(46,204,113,0.15)' : 'rgba(255,255,255,0.05)',
                  color: isGroup ? '#2ECC71' : '#556677', fontSize: '12px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                }}
              >
                <Hash size={13} /> Kanal / gruppe
              </button>
            </div>

            {isGroup && (
              <input
                placeholder="Kanalnavn (f.eks. general, salg)"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                style={{
                  background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '7px', padding: '9px 12px', color: '#ECF0F1',
                  fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box',
                }}
              />
            )}

            {/* Brugere */}
            <div style={{
              maxHeight: '220px', overflowY: 'auto',
              border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px',
            }}>
              {allUsers.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#445566', fontSize: '12px' }}>Indlæser...</div>
              ) : (
                allUsers.map(u => {
                  const picked = selectedUsers.includes(u.id);
                  const color = avatarColor(u.name);
                  return (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUsers(prev =>
                        picked ? prev.filter(id => id !== u.id) : [...prev, u.id]
                      )}
                      style={{
                        width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                        background: picked ? 'rgba(232,64,37,0.1)' : 'transparent',
                        padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                      }}
                    >
                      <div style={{
                        width: '30px', height: '30px', borderRadius: '7px',
                        background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 800, color: '#fff', flexShrink: 0,
                      }}>
                        {initials(u.name)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', color: '#ECF0F1' }}>{u.name}</div>
                        <div style={{ fontSize: '11px', color: '#445566' }}>{u.email}</div>
                      </div>
                      <div style={{
                        width: '18px', height: '18px', borderRadius: '4px',
                        border: picked ? 'none' : '1px solid rgba(255,255,255,0.15)',
                        background: picked ? '#E84025' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {picked && <Check size={11} color="#fff" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowNew(false)}
                style={{
                  flex: 1, padding: '9px', borderRadius: '7px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent', color: '#556677', cursor: 'pointer', fontSize: '13px',
                }}
              >
                Annuller
              </button>
              <button
                onClick={handleCreateConv}
                disabled={selectedUsers.length === 0 || creating}
                style={{
                  flex: 2, padding: '9px', borderRadius: '7px', border: 'none',
                  background: selectedUsers.length > 0 && !creating ? '#E84025' : 'rgba(255,255,255,0.06)',
                  color: selectedUsers.length > 0 && !creating ? '#fff' : '#445566',
                  cursor: selectedUsers.length > 0 && !creating ? 'pointer' : 'not-allowed',
                  fontSize: '13px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              >
                {creating ? 'Opretter...' : isGroup ? <><Hash size={13} /> Opret kanal</> : <><MessageSquare size={13} /> Start samtale</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
