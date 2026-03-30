'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Send, Plus, Users, MessageSquare, Hash, X, Check,
} from 'lucide-react';

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
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'nu';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}t`;
  return `${Math.floor(h / 24)}d`;
}

function convDisplayName(conv: Conversation): string {
  if (conv.type === 'group') return conv.name || 'Gruppe';
  if (conv.other_members && conv.other_members.length > 0) {
    return conv.other_members.map(m => m.name).join(', ');
  }
  return 'Samtale';
}

function convInitial(conv: Conversation): string {
  return convDisplayName(conv).charAt(0).toUpperCase();
}

export default function MessengerPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  // New conversation modal
  const [showNew, setShowNew] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isGroup, setIsGroup] = useState(false);
  const [creating, setCreating] = useState(false);

  // Current user
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);

  const messagesRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMe = useCallback(async () => {
    const res = await fetch('/api/auth/me');
    if (res.ok) setMe(await res.json());
  }, []);

  const fetchConversations = useCallback(async () => {
    const res = await fetch('/api/chat');
    if (res.ok) {
      const data = await res.json();
      setConversations(data);
    }
    setLoading(false);
  }, []);

  const fetchMessages = useCallback(async (convId: string) => {
    const res = await fetch(`/api/chat/${convId}`);
    if (res.ok) {
      setMessages(await res.json());
      // Opdater unread_count lokalt
      setConversations(prev => prev.map(c =>
        c.id === convId ? { ...c, unread_count: 0 } : c
      ));
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    const res = await fetch('/api/users');
    if (res.ok) setAllUsers(await res.json());
  }, []);

  useEffect(() => {
    fetchMe();
    fetchConversations();
  }, [fetchMe, fetchConversations]);

  // Poll for nye beskeder
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      fetchConversations();
      if (selectedId) fetchMessages(selectedId);
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedId, fetchConversations, fetchMessages]);

  useEffect(() => {
    if (selectedId) fetchMessages(selectedId);
  }, [selectedId, fetchMessages]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || !selectedId || sending) return;
    setSending(true);
    const res = await fetch(`/api/chat/${selectedId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text.trim() }),
    });
    if (res.ok) {
      const msg = await res.json();
      setMessages(prev => [...prev, msg]);
      setText('');
      // Opdater last_message i liste
      setConversations(prev => prev.map(c =>
        c.id === selectedId
          ? { ...c, last_message: msg.content, last_message_at: msg.created_at, last_sender_name: msg.sender_name }
          : c
      ));
    }
    setSending(false);
  };

  const handleOpenNew = () => {
    setShowNew(true);
    setSelectedUsers([]);
    setGroupName('');
    setIsGroup(false);
    fetchUsers();
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
    }
    setCreating(false);
  };

  const selectedConv = conversations.find(c => c.id === selectedId);
  const totalUnread = conversations.reduce((sum, c) => sum + Number(c.unread_count || 0), 0);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0F1923', overflow: 'hidden' }}>

      {/* ── Venstre: samtaler ──────────────────────────────── */}
      <div style={{
        width: '280px', flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        background: '#0B1520',
      }}>

        {/* Header */}
        <div style={{
          padding: '16px 14px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={15} style={{ color: '#185FA5' }} />
            <span style={{ fontWeight: 600, fontSize: '14px', color: '#ECF0F1' }}>Messenger</span>
            {totalUnread > 0 && (
              <span style={{
                background: '#185FA5', color: '#fff', fontSize: '10px',
                fontWeight: 700, borderRadius: '10px', padding: '1px 6px',
              }}>{totalUnread}</span>
            )}
          </div>
          <button
            onClick={handleOpenNew}
            title="Ny samtale"
            style={{
              width: 28, height: 28, borderRadius: 6, border: 'none',
              background: 'rgba(24,95,165,0.15)', cursor: 'pointer',
              color: '#185FA5', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Liste */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#445566', fontSize: '13px' }}>
              Indlæser...
            </div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#445566', fontSize: '13px' }}>
              <MessageSquare size={32} style={{ marginBottom: '8px', opacity: 0.3 }} />
              <div>Ingen samtaler endnu</div>
              <div style={{ fontSize: '11px', marginTop: '4px', color: '#334455' }}>
                Klik + for at starte en ny
              </div>
            </div>
          ) : (
            conversations.map(conv => {
              const isSelected = selectedId === conv.id;
              const hasUnread = Number(conv.unread_count) > 0;
              const name = convDisplayName(conv);

              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 14px',
                    border: 'none', cursor: 'pointer',
                    background: isSelected ? 'rgba(24,95,165,0.14)' : 'transparent',
                    borderLeft: isSelected ? '2px solid #185FA5' : '2px solid transparent',
                    display: 'flex', gap: '10px', alignItems: 'center',
                    transition: 'background 0.1s',
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '36px', height: '36px', borderRadius: conv.type === 'group' ? '8px' : '50%',
                    flexShrink: 0, background: conv.type === 'group' ? 'rgba(46,204,113,0.15)' : 'rgba(24,95,165,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 700,
                    color: conv.type === 'group' ? '#2ECC71' : '#185FA5',
                  }}>
                    {conv.type === 'group' ? <Hash size={14} /> : convInitial(conv)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{
                        fontSize: '13px', fontWeight: hasUnread ? 700 : 500,
                        color: '#ECF0F1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: '160px',
                      }}>
                        {name}
                      </span>
                      {conv.last_message_at && (
                        <span style={{ fontSize: '10px', color: '#445566', flexShrink: 0 }}>
                          {timeAgo(conv.last_message_at)}
                        </span>
                      )}
                    </div>
                    {conv.last_message && (
                      <div style={{
                        fontSize: '11px', color: hasUnread ? '#8899AA' : '#445566',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {conv.last_sender_name && (
                          <span style={{ color: '#556677', marginRight: '3px' }}>{conv.last_sender_name}:</span>
                        )}
                        {conv.last_message}
                      </div>
                    )}
                  </div>

                  {hasUnread && (
                    <div style={{
                      minWidth: '18px', height: '18px', borderRadius: '9px',
                      background: '#185FA5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', fontWeight: 700, color: '#fff', flexShrink: 0, padding: '0 4px',
                    }}>
                      {conv.unread_count}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Højre: chat ─────────────────────────────────────── */}
      {selectedConv ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Chat header */}
          <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', gap: '10px',
            background: '#0F1923',
          }}>
            <div style={{
              width: '34px', height: '34px',
              borderRadius: selectedConv.type === 'group' ? '8px' : '50%',
              flexShrink: 0,
              background: selectedConv.type === 'group' ? 'rgba(46,204,113,0.15)' : 'rgba(24,95,165,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 700,
              color: selectedConv.type === 'group' ? '#2ECC71' : '#185FA5',
            }}>
              {selectedConv.type === 'group' ? <Hash size={14} /> : convInitial(selectedConv)}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#ECF0F1' }}>
                {convDisplayName(selectedConv)}
              </div>
              {selectedConv.type === 'group' && selectedConv.other_members && (
                <div style={{ fontSize: '11px', color: '#445566' }}>
                  {selectedConv.other_members.map(m => m.name).join(', ')}
                </div>
              )}
            </div>
          </div>

          {/* Beskeder */}
          <div
            ref={messagesRef}
            style={{
              flex: 1, overflowY: 'auto', padding: '20px',
              display: 'flex', flexDirection: 'column', gap: '6px',
            }}
          >
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#334455', padding: '60px 0', fontSize: '13px' }}>
                Ingen beskeder endnu. Sig hej! 👋
              </div>
            ) : (
              messages.map((msg, i) => {
                const isMe = me && msg.sender_id === me.id;
                const prevMsg = messages[i - 1];
                const showName = !isMe && (!prevMsg || prevMsg.sender_id !== msg.sender_id);
                const isLastInGroup = !messages[i + 1] || messages[i + 1].sender_id !== msg.sender_id;

                return (
                  <div key={msg.id} style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start',
                    marginTop: showName && !isMe ? '8px' : '0',
                  }}>
                    {showName && (
                      <div style={{ fontSize: '11px', color: '#556677', marginBottom: '3px', paddingLeft: '2px' }}>
                        {msg.sender_name}
                      </div>
                    )}
                    <div style={{
                      maxWidth: '65%',
                      background: isMe ? '#185FA5' : '#111E2A',
                      border: isMe ? 'none' : '1px solid rgba(255,255,255,0.07)',
                      borderRadius: isMe
                        ? (isLastInGroup ? '14px 14px 3px 14px' : '14px 14px 14px 14px')
                        : (isLastInGroup ? '14px 14px 14px 3px' : '14px 14px 14px 14px'),
                      padding: '9px 13px',
                    }}>
                      <div style={{
                        fontSize: '13px', color: '#ECF0F1',
                        whiteSpace: 'pre-wrap', lineHeight: '1.5',
                        wordBreak: 'break-word',
                      }}>
                        {msg.content}
                      </div>
                    </div>
                    {isLastInGroup && (
                      <div style={{ fontSize: '10px', color: '#334455', marginTop: '2px', paddingLeft: '2px', paddingRight: '2px' }}>
                        {new Date(msg.created_at).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Skriv besked */}
          <div style={{
            padding: '12px 16px 14px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: '#0F1923',
          }}>
            <div style={{
              display: 'flex', gap: '10px', alignItems: 'flex-end',
              background: '#111E2A', borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '6px 6px 6px 14px',
            }}>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={`Skriv til ${convDisplayName(selectedConv)}...`}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                style={{
                  flex: 1, background: 'transparent', border: 'none',
                  color: '#ECF0F1', fontSize: '13px', outline: 'none',
                  resize: 'none', lineHeight: '1.5', fontFamily: 'inherit',
                  maxHeight: '120px', overflowY: 'auto',
                  paddingTop: '6px', paddingBottom: '6px',
                }}
              />
              <button
                onClick={handleSend}
                disabled={!text.trim() || sending}
                style={{
                  width: 34, height: 34, borderRadius: '8px', border: 'none', flexShrink: 0,
                  background: text.trim() && !sending ? '#185FA5' : 'rgba(255,255,255,0.06)',
                  color: text.trim() && !sending ? '#fff' : '#445566',
                  cursor: text.trim() && !sending ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
              >
                <Send size={14} />
              </button>
            </div>
            <div style={{ fontSize: '10px', color: '#334455', marginTop: '5px', paddingLeft: '2px' }}>
              Enter for at sende · Shift+Enter for ny linje
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: '#334455', gap: '10px',
        }}>
          <MessageSquare size={48} style={{ opacity: 0.15 }} />
          <div style={{ fontSize: '15px', color: '#445566', fontWeight: 500 }}>Vælg en samtale</div>
          <div style={{ fontSize: '12px' }}>eller klik + for at starte en ny</div>
          <button
            onClick={handleOpenNew}
            style={{
              marginTop: '8px', background: 'rgba(24,95,165,0.15)',
              border: '1px solid rgba(24,95,165,0.3)', borderRadius: '8px',
              color: '#185FA5', fontSize: '13px', padding: '8px 16px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <Plus size={14} /> Ny samtale
          </button>
        </div>
      )}

      {/* ── Modal: Ny samtale ────────────────────────────────── */}
      {showNew && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowNew(false); }}
        >
          <div style={{
            background: '#111E2A', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px', padding: '24px', width: '420px',
            maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: '#ECF0F1', fontWeight: 600 }}>
                Ny samtale
              </h3>
              <button onClick={() => setShowNew(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#445566' }}>
                <X size={16} />
              </button>
            </div>

            {/* Type toggle */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setIsGroup(false)}
                style={{
                  flex: 1, padding: '8px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  background: !isGroup ? 'rgba(24,95,165,0.2)' : 'rgba(255,255,255,0.05)',
                  color: !isGroup ? '#185FA5' : '#556677', fontSize: '12px', fontWeight: 600,
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
                <Users size={13} /> Gruppe
              </button>
            </div>

            {/* Gruppenavn */}
            {isGroup && (
              <input
                placeholder="Gruppenavn (valgfrit)"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                style={{
                  background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '7px', padding: '9px 12px', color: '#ECF0F1',
                  fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box',
                }}
              />
            )}

            {/* Brugerliste */}
            <div>
              <div style={{ fontSize: '11px', color: '#445566', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Vælg deltagere
              </div>
              <div style={{
                maxHeight: '220px', overflowY: 'auto',
                border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px',
              }}>
                {allUsers.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#445566', fontSize: '12px' }}>
                    Indlæser brugere...
                  </div>
                ) : (
                  allUsers.map(u => {
                    const picked = selectedUsers.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() => setSelectedUsers(prev =>
                          picked ? prev.filter(id => id !== u.id) : [...prev, u.id]
                        )}
                        style={{
                          width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                          background: picked ? 'rgba(24,95,165,0.15)' : 'transparent',
                          padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px',
                          transition: 'background 0.1s',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                        }}
                      >
                        <div style={{
                          width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                          background: 'rgba(24,95,165,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '12px', fontWeight: 700, color: '#185FA5',
                        }}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', color: '#ECF0F1', fontWeight: 500 }}>{u.name}</div>
                          <div style={{ fontSize: '11px', color: '#445566' }}>{u.email}</div>
                        </div>
                        <div style={{
                          width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                          border: picked ? 'none' : '1px solid rgba(255,255,255,0.15)',
                          background: picked ? '#185FA5' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {picked && <Check size={11} color="#fff" />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {selectedUsers.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {selectedUsers.map(uid => {
                  const u = allUsers.find(x => x.id === uid);
                  return u ? (
                    <span key={uid} style={{
                      background: 'rgba(24,95,165,0.2)', color: '#185FA5',
                      borderRadius: '20px', padding: '3px 10px', fontSize: '11px',
                      display: 'flex', alignItems: 'center', gap: '5px',
                    }}>
                      {u.name}
                      <button
                        onClick={() => setSelectedUsers(prev => prev.filter(id => id !== uid))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#185FA5', padding: 0, display: 'flex' }}
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowNew(false)}
                style={{
                  flex: 1, padding: '9px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.1)',
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
                  background: selectedUsers.length > 0 && !creating ? '#185FA5' : 'rgba(255,255,255,0.06)',
                  color: selectedUsers.length > 0 && !creating ? '#fff' : '#445566',
                  cursor: selectedUsers.length > 0 && !creating ? 'pointer' : 'not-allowed',
                  fontSize: '13px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
              >
                {creating ? 'Opretter...' : (
                  <>
                    {isGroup || selectedUsers.length > 1 ? <Users size={13} /> : <MessageSquare size={13} />}
                    {isGroup || selectedUsers.length > 1 ? 'Opret gruppe' : 'Start samtale'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        textarea { field-sizing: content; }
      `}</style>
    </div>
  );
}
