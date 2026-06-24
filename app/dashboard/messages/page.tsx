'use client';

import { useEffect, useRef, useState } from 'react';

interface Channel { id: number; name: string; company_name: string; company_color: string; is_general: boolean }
interface DmConv { id: number; participant_a: string; participant_b: string; participant_a_name: string; participant_b_name: string; last_message: string | null; last_message_at: string | null }
interface Message { id: number; sender_id: string; sender_name: string; body: string; created_at: string }
interface User { id: string; name: string; role: string }

type ActiveView = { type: 'channel'; id: number; name: string } | { type: 'dm'; id: number; name: string } | null;

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

export default function MessagesPage() {
  const [myId, setMyId] = useState('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dms, setDms] = useState<DmConv[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [active, setActive] = useState<ActiveView>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const [dmModal, setDmModal] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creatingDm, setCreatingDm] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  async function loadMe() {
    const me = await fetch('/api/auth/me').then(r => r.json()) as { id: string };
    setMyId(me.id ?? '');
  }

  async function loadChannels() {
    const data = await fetch('/api/channels').then(r => r.json()) as Channel[];
    setChannels(data);
    if (!active && data.length > 0) {
      selectChannel(data[0]);
    }
  }

  async function loadDms() {
    const data = await fetch('/api/dm').then(r => r.json()) as DmConv[];
    setDms(data);
  }

  function selectChannel(ch: Channel) {
    setActive({ type: 'channel', id: ch.id, name: `#${ch.name}` });
    setShowThread(true);
  }

  function selectDm(dm: DmConv) {
    const otherName = dm.participant_a === myId ? dm.participant_b_name : dm.participant_a_name;
    setActive({ type: 'dm', id: dm.id, name: otherName });
    setShowThread(true);
  }

  async function loadMessages() {
    if (!active) return;
    const url = active.type === 'channel'
      ? `/api/channels/${active.id}/messages`
      : `/api/dm/${active.id}/messages`;
    const data = await fetch(url).then(r => r.json()) as Message[];
    setMessages(data);
  }

  async function openDmModal() {
    setDmModal(true);
    if (users.length > 0) return;
    setLoadingUsers(true);
    try {
      const data = await fetch('/api/admin/sellers').then(r => r.json()) as User[];
      setUsers(Array.isArray(data) ? data.filter(u => u.id !== myId) : []);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function startDm(userId: string, userName: string) {
    if (creatingDm) return;
    setCreatingDm(true);
    try {
      const conv = await fetch('/api/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ other_user_id: userId }),
      }).then(r => r.json()) as DmConv;
      await loadDms();
      setActive({ type: 'dm', id: conv.id, name: userName });
      setShowThread(true);
      setDmModal(false);
    } finally {
      setCreatingDm(false);
    }
  }

  useEffect(() => { loadMe(); loadChannels(); loadDms(); }, []);

  useEffect(() => {
    loadMessages();
    clearInterval(pollRef.current);
    pollRef.current = setInterval(loadMessages, 5000);
    return () => clearInterval(pollRef.current);
  }, [active]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    if (!body.trim() || !active || sending) return;
    setSending(true);
    const url = active.type === 'channel'
      ? `/api/channels/${active.id}/messages`
      : `/api/dm/${active.id}/messages`;
    await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: body.trim() }),
    });
    setBody('');
    setSending(false);
    await loadMessages();
    inputRef.current?.focus();
  }

  const groupedByCompany = channels.reduce<Record<string, Channel[]>>((acc, ch) => {
    const key = ch.company_name ?? 'Andet';
    (acc[key] ??= []).push(ch);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <div className={`msg-list${showThread ? ' hidden-mobile' : ''}`} style={{
        width: 240, flexShrink: 0, borderRight: '1px solid var(--bd)',
        background: 'var(--s1)', display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>Beskeder</span>
          <button onClick={openDmModal} title="Ny direkte besked"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t2)', fontSize: 18, lineHeight: 1, padding: '2px 4px', borderRadius: 5, transition: 'color 0.12s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--t1)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--t2)')}>
            ✎
          </button>
        </div>

        {/* Channels */}
        {Object.entries(groupedByCompany).map(([company, chs]) => (
          <div key={company}>
            <div style={{ padding: '10px 14px 4px', fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
              {company}
            </div>
            {chs.map(ch => {
              const isActive = active?.type === 'channel' && active.id === ch.id;
              return (
                <button key={ch.id} onClick={() => selectChannel(ch)}
                  style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, color: isActive ? 'var(--t1)' : 'var(--t2)', background: isActive ? 'var(--bl3)' : 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, minHeight: 44 }}>
                  <span style={{ color: 'var(--t3)' }}>#</span> {ch.name}
                </button>
              );
            })}
          </div>
        ))}

        {/* DMs */}
        {dms.length > 0 && (
          <div>
            <div style={{ padding: '10px 14px 4px', fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
              Direkte beskeder
            </div>
            {dms.map(dm => {
              const otherName = dm.participant_a === myId ? dm.participant_b_name : dm.participant_a_name;
              const isActive = active?.type === 'dm' && active.id === dm.id;
              return (
                <button key={dm.id} onClick={() => selectDm(dm)}
                  style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, color: isActive ? 'var(--t1)' : 'var(--t2)', background: isActive ? 'var(--bl3)' : 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--s3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--t2)', flexShrink: 0 }}>
                    {otherName.charAt(0).toUpperCase()}
                  </span>
                  <span>{otherName}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Thread */}
      <div className={`msg-thread${showThread ? ' active' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {active ? (
          <>
            {/* Thread header */}
            <div style={{ padding: '0 18px', height: 46, borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--s1)', flexShrink: 0 }}>
              <button onClick={() => setShowThread(false)} style={{ display: 'none', background: 'none', border: 'none', color: 'var(--t2)', fontSize: 20, padding: '0 4px' }} className="back-btn">←</button>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--t1)' }}>{active.name}</div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--t3)', fontSize: 13, marginTop: 40 }}>Ingen beskeder endnu</div>
              )}
              {messages.map((msg, i) => {
                const isOwn = msg.sender_id === myId;
                const showName = !isOwn && (i === 0 || messages[i - 1].sender_id !== msg.sender_id);
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: isOwn ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, marginBottom: 2 }}>
                    {!isOwn && (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--s3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--t2)', flexShrink: 0, marginBottom: 2 }}>
                        {msg.sender_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ maxWidth: '70%' }}>
                      {showName && (
                        <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 3, marginLeft: 4 }}>{msg.sender_name}</div>
                      )}
                      <div style={{
                        background: isOwn ? 'var(--bl2)' : 'var(--s2)',
                        border: `1px solid ${isOwn ? 'rgba(79,142,247,0.3)' : 'var(--bd)'}`,
                        borderRadius: isOwn ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                        padding: '8px 12px', fontSize: 13, color: 'var(--t1)', lineHeight: 1.5,
                        wordBreak: 'break-word',
                      }}>
                        {msg.body}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2, textAlign: isOwn ? 'right' : 'left', marginRight: 4, marginLeft: 4 }}>
                        {formatTime(msg.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--bd)', background: 'var(--s1)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea ref={inputRef} value={body} onChange={e => setBody(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Skriv en besked…"
                rows={1}
                style={{ flex: 1, resize: 'none', borderRadius: 8, padding: '10px 12px', fontSize: 14, lineHeight: 1.4, minHeight: 44 }}
              />
              <button onClick={send} disabled={!body.trim() || sending}
                style={{ background: 'var(--bl)', color: '#fff', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, flexShrink: 0, minHeight: 44, minWidth: 44 }}>
                ↑
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 13 }}>
            Vælg en kanal for at starte
          </div>
        )}
      </div>

      {/* DM modal */}
      {dmModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setDmModal(false)}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, width: 320, maxHeight: 420, display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>Ny direkte besked</span>
              <button onClick={() => setDmModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {loadingUsers ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>
              ) : users.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Ingen brugere fundet</div>
              ) : (
                users.map(u => (
                  <button key={u.id} onClick={() => void startDm(u.id, u.name)} disabled={creatingDm}
                    style={{ width: '100%', textAlign: 'left', padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--t1)', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                    <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--s3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--t2)', flexShrink: 0 }}>
                      {u.name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--t3)' }}>{u.role}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 767px) {
          .hidden-mobile { display: none !important; }
          .msg-list { width: 100% !important; }
          .msg-thread { position: absolute; inset: 0; transform: translateX(100%); transition: transform 0.25s ease; }
          .msg-thread.active { transform: translateX(0); }
          .back-btn { display: block !important; }
        }
      `}</style>
    </div>
  );
}
