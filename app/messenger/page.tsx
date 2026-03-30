'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, RefreshCw, Mail, Inbox, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

interface Conversation {
  contact_email: string;
  contact_name: string | null;
  subject: string | null;
  body_text: string | null;
  direction: 'inbound' | 'outbound';
  received_at: string;
  read: boolean;
  unread_count: number;
  lead_id: string | null;
  customer_id: string | null;
  lead_company: string | null;
  lead_contact_name: string | null;
  customer_company: string | null;
}

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  from_email: string;
  from_name: string | null;
  to_email: string;
  subject: string | null;
  body_text: string | null;
  received_at: string;
  read: boolean;
  lead_company: string | null;
  lead_name: string | null;
  lead_status: string | null;
  customer_company: string | null;
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

export default function MessengerPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    const res = await fetch('/api/messages');
    if (res.ok) setConversations(await res.json());
    setLoading(false);
  }, []);

  const fetchThread = useCallback(async (email: string) => {
    const res = await fetch(`/api/messages?thread=${encodeURIComponent(email)}`);
    if (res.ok) {
      setThread(await res.json());
      // Opdater unread count lokalt
      setConversations(prev => prev.map(c =>
        c.contact_email === email ? { ...c, unread_count: 0, read: true } : c
      ));
    }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  useEffect(() => {
    if (selected) fetchThread(selected);
  }, [selected, fetchThread]);

  useEffect(() => {
    // Scroll til bunden når tråd opdateres
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [thread]);

  const handleSync = async () => {
    setSyncing(true);
    await fetch('/api/agents/se-imap/run', { method: 'POST' }).catch(() => {});
    await fetchConversations();
    if (selected) await fetchThread(selected);
    setSyncing(false);
  };

  const handleSend = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    const selectedConv = conversations.find(c => c.contact_email === selected);
    const subject = selectedConv?.subject
      ? (selectedConv.subject.startsWith('Re:') ? selectedConv.subject : `Re: ${selectedConv.subject}`)
      : 'Svar fra BusyGroup';

    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: selected, subject, body: reply }),
    });
    setReply('');
    await fetchThread(selected);
    setSending(false);
  };

  const selectedConv = conversations.find(c => c.contact_email === selected);
  const totalUnread = conversations.reduce((sum, c) => sum + Number(c.unread_count || 0), 0);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0F1923', overflow: 'hidden' }}>

      {/* Venstre: samtaleliste */}
      <div style={{
        width: '320px', flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Inbox size={16} style={{ color: '#185FA5' }} />
            <span style={{ fontWeight: 600, fontSize: '14px', color: '#ECF0F1' }}>Indbakke</span>
            {totalUnread > 0 && (
              <span style={{
                background: '#185FA5', color: '#fff', fontSize: '10px',
                fontWeight: 700, borderRadius: '10px', padding: '1px 6px',
              }}>{totalUnread}</span>
            )}
          </div>
          <button
            onClick={handleSync}
            title="Synkroniser IMAP"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: syncing ? '#185FA5' : '#445566', padding: '4px',
              animation: syncing ? 'spin 1s linear infinite' : 'none',
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Samtaler */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#445566', fontSize: '13px' }}>
              Indlæser...
            </div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#445566', fontSize: '13px' }}>
              <Mail size={32} style={{ marginBottom: '8px', opacity: 0.3 }} />
              <div>Ingen beskeder endnu</div>
              <div style={{ fontSize: '11px', marginTop: '4px' }}>Tilføj IMAP-konti i Indstillinger</div>
            </div>
          ) : (
            conversations.map(conv => {
              const isSelected = selected === conv.contact_email;
              const hasUnread = Number(conv.unread_count) > 0;
              const displayName = conv.lead_company || conv.customer_company || conv.lead_contact_name || conv.contact_name || conv.contact_email;

              return (
                <button
                  key={conv.contact_email}
                  onClick={() => setSelected(conv.contact_email)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '12px 16px',
                    border: 'none', cursor: 'pointer',
                    background: isSelected ? 'rgba(24,95,165,0.12)' : 'transparent',
                    borderLeft: isSelected ? '2px solid #185FA5' : '2px solid transparent',
                    display: 'flex', gap: '10px', alignItems: 'flex-start',
                    transition: 'background 0.1s',
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                    background: conv.direction === 'inbound' ? 'rgba(24,95,165,0.2)' : 'rgba(46,204,113,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 700,
                    color: conv.direction === 'inbound' ? '#185FA5' : '#2ECC71',
                  }}>
                    {(displayName || '?').charAt(0).toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{
                        fontSize: '13px', fontWeight: hasUnread ? 700 : 500,
                        color: '#ECF0F1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: '160px',
                      }}>
                        {displayName}
                      </span>
                      <span style={{ fontSize: '10px', color: '#445566', flexShrink: 0 }}>
                        {timeAgo(conv.received_at)}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '11px', color: hasUnread ? '#8899AA' : '#445566',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {conv.direction === 'outbound' && <span style={{ color: '#2ECC71', marginRight: '4px' }}>Du:</span>}
                      {conv.body_text?.slice(0, 60) || conv.subject || '—'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#334455', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conv.contact_email}
                    </div>
                  </div>

                  {hasUnread && (
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: '#185FA5', flexShrink: 0, marginTop: '4px',
                    }} />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Højre: tråd + svar */}
      {selected ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Tråd-header */}
          <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#ECF0F1' }}>
                {selectedConv?.lead_company || selectedConv?.customer_company || selectedConv?.lead_contact_name || selectedConv?.contact_name || selected}
              </div>
              <div style={{ fontSize: '11px', color: '#445566' }}>{selected}</div>
            </div>
            {selectedConv?.lead_id && (
              <Link href={`/crm`} style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '11px', color: '#185FA5', textDecoration: 'none',
                background: 'rgba(24,95,165,0.1)', borderRadius: '5px', padding: '4px 8px',
              }}>
                <ArrowUpRight size={11} /> Åbn i CRM
              </Link>
            )}
          </div>

          {/* Beskeder */}
          <div ref={threadRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {thread.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#445566', padding: '60px 0', fontSize: '13px' }}>
                Ingen beskeder i denne tråd endnu
              </div>
            ) : (
              thread.map(msg => {
                const isOut = msg.direction === 'outbound';
                return (
                  <div key={msg.id} style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: isOut ? 'flex-end' : 'flex-start',
                  }}>
                    <div style={{
                      maxWidth: '72%',
                      background: isOut ? '#185FA5' : '#111E2A',
                      border: isOut ? 'none' : '1px solid rgba(255,255,255,0.07)',
                      borderRadius: isOut ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                      padding: '10px 14px',
                    }}>
                      {msg.subject && (
                        <div style={{ fontSize: '10px', color: isOut ? 'rgba(255,255,255,0.6)' : '#445566', marginBottom: '4px', fontStyle: 'italic' }}>
                          {msg.subject}
                        </div>
                      )}
                      <div style={{ fontSize: '13px', color: '#ECF0F1', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                        {msg.body_text || '(Ingen tekst)'}
                      </div>
                    </div>
                    <div style={{ fontSize: '10px', color: '#334455', marginTop: '3px' }}>
                      {isOut ? 'Du' : (msg.from_name || msg.from_email)} · {new Date(msg.received_at).toLocaleString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Svar-boks */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', gap: '10px', alignItems: 'flex-end',
          }}>
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder={`Svar til ${selected}...`}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(); }}
              style={{
                flex: 1, background: '#111E2A', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', color: '#ECF0F1', fontSize: '13px',
                padding: '10px 12px', resize: 'none', outline: 'none',
                minHeight: '60px', maxHeight: '140px',
                fontFamily: 'inherit', lineHeight: '1.5',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!reply.trim() || sending}
              style={{
                background: reply.trim() && !sending ? '#185FA5' : 'rgba(255,255,255,0.06)',
                border: 'none', borderRadius: '8px', padding: '10px 14px',
                color: reply.trim() && !sending ? '#fff' : '#445566',
                cursor: reply.trim() && !sending ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '13px', fontWeight: 600, flexShrink: 0,
                transition: 'all 0.15s',
              }}
            >
              <Send size={14} /> {sending ? 'Sender...' : 'Send'}
            </button>
          </div>
          <div style={{ padding: '4px 16px 10px', fontSize: '10px', color: '#334455' }}>
            ⌘ + Enter for at sende
          </div>
        </div>
      ) : (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: '#334455', gap: '8px',
        }}>
          <Mail size={40} style={{ opacity: 0.2 }} />
          <div style={{ fontSize: '14px' }}>Vælg en samtale</div>
          <div style={{ fontSize: '11px' }}>eller tilføj IMAP-konti i Indstillinger</div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
