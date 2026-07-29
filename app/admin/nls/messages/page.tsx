'use client';

import { useEffect, useRef, useState } from 'react';

interface Channel { id: number; name: string; company_name: string; company_color: string; is_general: boolean }
interface DmConv { id: number; participant_a: string; participant_b: string; participant_a_name: string; participant_b_name: string; last_message: string | null }
interface Message { id: number; sender_id: string; sender_name: string; body: string; created_at: string }
interface User { id: string; name: string; role: string }

type ActiveView = { type: 'channel'; id: number; name: string } | { type: 'dm'; id: number; name: string } | null;

const COMPANY_NAME = 'NextLevel Sales';

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

export default function NlsMessagesPage() {
  const [myId, setMyId] = useState('');
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [dms, setDms] = useState<DmConv[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [active, setActive] = useState<ActiveView>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelMembers, setNewChannelMembers] = useState<Set<string>>(new Set());
  const [sendError, setSendError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<{ id: number; name: string; slug: string }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const channels = allChannels.filter(c => c.company_name === COMPANY_NAME);

  async function loadAll() {
    const [me, chs, dmsData, usersData, comps] = await Promise.all([
      fetch('/api/auth/me').then(r => r.json()) as Promise<{ id: string }>,
      fetch('/api/channels').then(r => r.json()) as Promise<Channel[]>,
      fetch('/api/dm').then(r => r.json()) as Promise<DmConv[]>,
      fetch('/api/users').then(r => r.json()) as Promise<User[]>,
      fetch('/api/companies').then(r => r.json()) as Promise<{ id: number; name: string; slug: string }[]>,
    ]);
    setMyId(me.id ?? '');
    setAllChannels(Array.isArray(chs) ? chs : []);
    setDms(Array.isArray(dmsData) ? dmsData : []);
    setUsers(Array.isArray(usersData) ? usersData : []);
    setCompanies(Array.isArray(comps) ? comps : []);
    const nlsChs = Array.isArray(chs) ? chs.filter(c => c.company_name === COMPANY_NAME) : [];
    if (!active && nlsChs.length > 0) {
      setActive({ type: 'channel', id: nlsChs[0].id, name: `#${nlsChs[0].name}` });
      setShowThread(true);
    }
  }

  async function loadMessages() {
    if (!active) return;
    const url = active.type === 'channel'
      ? `/api/channels/${active.id}/messages`
      : `/api/dm/${active.id}/messages`;
    const data = await fetch(url).then(r => r.json()) as Message[];
    setMessages(data);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAll(); }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadMessages();
    clearInterval(pollRef.current);
    pollRef.current = setInterval(loadMessages, 5000);
    return () => clearInterval(pollRef.current);
  }, [active]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send() {
    if (!body.trim() || !active || sending) return;
    setSending(true);
    setSendError(null);
    const trimmed = body.trim();
    const url = active.type === 'channel'
      ? `/api/channels/${active.id}/messages`
      : `/api/dm/${active.id}/messages`;
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: trimmed }) });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { error?: string };
        setSendError(errBody.error ?? `Kunne ikke sende (fejl ${res.status})`);
        return;
      }
      const resp = await res.json() as Message;
      setBody('');
      setMessages(prev => [...prev, resp]);
    } catch {
      setSendError('Netværksfejl — beskeden blev ikke sendt');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function deleteChannel(channelId: number) {
    if (!window.confirm('Slet kanalen? Alle beskeder i den forsvinder, og det kan ikke fortrydes.')) return;
    const res = await fetch(`/api/channels/${channelId}`, { method: 'DELETE' });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as { error?: string };
      alert(errBody.error ?? 'Kunne ikke slette kanalen');
      return;
    }
    setActive(null);
    const data = await fetch('/api/channels').then(r => r.json()) as Channel[];
    setAllChannels(data);
  }

  async function startDm(userId: string) {
    await fetch('/api/dm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ other_user_id: userId }) });
    setShowNewDm(false);
    const data = await fetch('/api/dm').then(r => r.json()) as DmConv[];
    setDms(data);
  }

  function toggleNewChannelMember(userId: string) {
    setNewChannelMembers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  }

  async function createChannel() {
    if (!newChannelName.trim()) return;
    const nlsCompany = companies.find(c => c.slug === 'nls');
    if (!nlsCompany) return;
    const channel = await fetch('/api/channels', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newChannelName.trim(), company_id: nlsCompany.id }),
    }).then(r => r.json()) as Channel;
    await Promise.all(Array.from(newChannelMembers).map(userId =>
      fetch(`/api/channels/${channel.id}/members`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
    ));
    setNewChannelName('');
    setNewChannelMembers(new Set());
    setShowNewChannel(false);
    const data = await fetch('/api/channels').then(r => r.json()) as Channel[];
    setAllChannels(data);
  }

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)' }}>
      <div className={`msg-list${showThread ? ' hidden-mobile' : ''}`} style={{ width: 240, flexShrink: 0, borderRight: '1px solid var(--bd)', background: 'var(--s1)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>NLS · Beskeder</span>
          <div style={{ display: 'flex', gap: 2 }}>
            <button onClick={() => setShowNewChannel(true)} style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 17, padding: '0 5px', cursor: 'pointer', minHeight: 44, minWidth: 36 }} title="Ny kanal">+</button>
            <button onClick={() => setShowNewDm(true)} style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 15, padding: '0 5px', cursor: 'pointer', minHeight: 44, minWidth: 36 }} title="Ny DM">✉</button>
          </div>
        </div>

        {channels.length > 0 && (
          <div>
            <div style={{ padding: '10px 14px 4px', fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>Kanaler</div>
            {channels.map(ch => {
              const isAct = active?.type === 'channel' && active.id === ch.id;
              return (
                <button key={ch.id} onClick={() => { setActive({ type: 'channel', id: ch.id, name: `#${ch.name}` }); setShowThread(true); }}
                  style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, color: isAct ? 'var(--t1)' : 'var(--t2)', background: isAct ? 'var(--bl3)' : 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, minHeight: 44 }}>
                  <span style={{ color: 'var(--t3)' }}>#</span> {ch.name}
                </button>
              );
            })}
          </div>
        )}

        {dms.length > 0 && (
          <div>
            <div style={{ padding: '10px 14px 4px', fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>Direkte</div>
            {dms.map(dm => {
              const otherName = dm.participant_a === myId ? dm.participant_b_name : dm.participant_a_name;
              const isAct = active?.type === 'dm' && active.id === dm.id;
              return (
                <button key={dm.id} onClick={() => { setActive({ type: 'dm', id: dm.id, name: otherName }); setShowThread(true); }}
                  style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, color: isAct ? 'var(--t1)' : 'var(--t2)', background: isAct ? 'var(--bl3)' : 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
                  <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--s3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--t2)', flexShrink: 0 }}>{otherName.charAt(0).toUpperCase()}</span>
                  <span>{otherName}</span>
                </button>
              );
            })}
          </div>
        )}

        {channels.length === 0 && dms.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
            Ingen kanaler endnu.<br />Klik + for at oprette en.
          </div>
        )}
      </div>

      <div className={`msg-thread${showThread ? ' active' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {active ? (
          <>
            <div style={{ padding: '0 18px', height: 46, borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--s1)', flexShrink: 0 }}>
              <button onClick={() => setShowThread(false)} className="back-btn" style={{ display: 'none', background: 'none', border: 'none', color: 'var(--t2)', fontSize: 20, padding: '0 4px' }}>←</button>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--t1)', flex: 1 }}>{active.name}</div>
              {active.type === 'channel' && (
                <button onClick={() => void deleteChannel(active.id)} title="Slet kanal"
                  style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 12, padding: '4px 6px' }}>🗑</button>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {messages.length === 0 && <div style={{ textAlign: 'center', color: 'var(--t3)', fontSize: 13, marginTop: 40 }}>Ingen beskeder endnu</div>}
              {messages.map((msg, i) => {
                const isOwn = msg.sender_id === myId;
                const showName = !isOwn && (i === 0 || messages[i - 1].sender_id !== msg.sender_id);
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: isOwn ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, marginBottom: 2 }}>
                    {!isOwn && <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--s3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--t2)', flexShrink: 0 }}>{msg.sender_name.charAt(0).toUpperCase()}</div>}
                    <div style={{ maxWidth: '70%' }}>
                      {showName && <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 3, marginLeft: 4 }}>{msg.sender_name}</div>}
                      <div style={{ background: isOwn ? 'var(--bl2)' : 'var(--s2)', border: `1px solid ${isOwn ? 'rgba(79,142,247,0.3)' : 'var(--bd)'}`, borderRadius: isOwn ? '12px 12px 4px 12px' : '12px 12px 12px 4px', padding: '8px 12px', fontSize: 13, color: 'var(--t1)', lineHeight: 1.5, wordBreak: 'break-word' }}>{msg.body}</div>
                      <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2, textAlign: isOwn ? 'right' : 'left', marginRight: 4, marginLeft: 4 }}>{formatTime(msg.created_at)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            {sendError && (
              <div style={{ padding: '8px 18px', background: 'var(--re2)', color: 'var(--re)', fontSize: 12, borderTop: '1px solid rgba(244,63,94,0.2)' }}>{sendError}</div>
            )}
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--bd)', background: 'var(--s1)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea ref={inputRef} value={body} onChange={e => setBody(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Skriv en besked…" rows={1}
                style={{ flex: 1, resize: 'none', borderRadius: 8, padding: '10px 12px', fontSize: 14, lineHeight: 1.4, minHeight: 44 }} />
              <button onClick={send} disabled={!body.trim() || sending}
                style={{ background: 'var(--bl)', color: '#fff', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, flexShrink: 0, minHeight: 44 }}>↑</button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 13 }}>Vælg en kanal for at starte</div>
        )}
      </div>

      {showNewDm && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowNewDm(false); }}>
          <div className="modal-box" style={{ background: 'var(--s1)', borderRadius: 13, padding: 24, width: 360, maxWidth: '94vw', boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 16 }}>Ny direkte besked</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflowY: 'auto' }}>
              {users.filter(u => u.id !== myId).map(u => (
                <button key={u.id} onClick={() => startDm(u.id)}
                  style={{ textAlign: 'left', padding: '10px 14px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', minHeight: 44 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--s3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--t2)', flexShrink: 0 }}>{u.name.charAt(0).toUpperCase()}</div>
                  <div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{u.name}</div><div style={{ fontSize: 11, color: 'var(--t3)' }}>{u.role}</div></div>
                </button>
              ))}
            </div>
            <button onClick={() => setShowNewDm(false)} style={{ marginTop: 16, width: '100%', background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12 }}>Luk</button>
          </div>
        </div>
      )}

      {showNewChannel && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowNewChannel(false); }}>
          <div className="modal-box" style={{ background: 'var(--s1)', borderRadius: 13, padding: 24, width: 360, maxWidth: '94vw', boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 16 }}>Ny kanal · NLS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label>Kanalnavn</label><input value={newChannelName} onChange={e => setNewChannelName(e.target.value)} placeholder="e.g. projekter" autoFocus /></div>
            </div>
            <div style={{ marginTop: 14, fontSize: 11, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Tilføj medlemmer</div>
            <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
              {users.filter(u => u.id !== myId).map(u => {
                const checked = newChannelMembers.has(u.id);
                return (
                  <button key={u.id} onClick={() => toggleNewChannelMember(u.id)}
                    style={{ width: '100%', textAlign: 'left', padding: '7px 4px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--t1)' }}>
                    <span style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0, border: `1.5px solid ${checked ? 'var(--bl)' : 'var(--bd)'}`, background: checked ? 'var(--bl)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff' }}>{checked ? '✓' : ''}</span>
                    {u.name}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewChannel(false)} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12 }}>Annuller</button>
              <button onClick={createChannel} disabled={!newChannelName.trim()} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600 }}>Opret</button>
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
