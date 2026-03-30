'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Send, Pencil, Inbox, SendHorizonal, X, ArrowLeft, User } from 'lucide-react';
import { toast } from 'sonner';

interface Email {
  id: string;
  direction: 'inbound' | 'outbound';
  from_email: string;
  from_name: string | null;
  to_email: string;
  subject: string | null;
  preview?: string;
  body_text?: string;
  read: boolean;
  received_at: string;
  lead_company?: string;
  customer_company?: string;
  account_name?: string;
  imap_account_id?: string;
}

interface Account {
  id: string;
  name: string;
  email: string;
  active: boolean;
  last_sync: string | null;
}

function timeStr(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
  if (diffDays < 7)  return d.toLocaleDateString('da-DK', { weekday: 'short' });
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

export default function MailPage() {
  const [accounts,       setAccounts]       = useState<Account[]>([]);
  const [emails,         setEmails]         = useState<Email[]>([]);
  const [selectedEmail,  setSelectedEmail]  = useState<Email | null>(null);
  const [folder,         setFolder]         = useState<'inbox' | 'sent'>('inbox');
  const [activeAccount,  setActiveAccount]  = useState<string | null>(null);
  const [syncing,        setSyncing]        = useState(false);
  const [showCompose,    setShowCompose]    = useState(false);
  const [replying,       setReplying]       = useState(false);
  const [replyText,      setReplyText]      = useState('');
  const [compose,        setCompose]        = useState({ to: '', subject: '', body: '' });
  const [sending,        setSending]        = useState(false);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  const fetchAccounts = useCallback(async () => {
    const res = await fetch('/api/imap-accounts');
    if (res.ok) setAccounts(await res.json());
  }, []);

  const fetchEmails = useCallback(async () => {
    const params = new URLSearchParams({ folder });
    if (activeAccount) params.set('account', activeAccount);
    const res = await fetch(`/api/mail?${params}`);
    if (res.ok) setEmails(await res.json());
  }, [folder, activeAccount]);

  const openEmail = useCallback(async (email: Email) => {
    if (!email.body_text) {
      const res = await fetch(`/api/mail?id=${email.id}`);
      if (res.ok) {
        const full = await res.json();
        setSelectedEmail(full);
        setEmails(prev => prev.map(e => e.id === email.id ? { ...e, read: true } : e));
      }
    } else {
      setSelectedEmail(email);
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, read: true } : e));
    }
    setReplying(false);
    setReplyText('');
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);
  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/agents/se-imap/run', { method: 'POST' });
      await fetchEmails();
      toast.success('Indbakke synkroniseret');
    } catch { toast.error('Synkronisering fejlede'); }
    finally { setSyncing(false); }
  };

  const handleSend = async (isReply: boolean) => {
    setSending(true);
    try {
      const body = isReply
        ? { to: selectedEmail!.from_email, subject: `Re: ${selectedEmail!.subject || ''}`, body: replyText, fromAccountId: selectedEmail?.imap_account_id, inReplyToId: selectedEmail!.id }
        : { to: compose.to, subject: compose.subject, body: compose.body, fromAccountId: activeAccount };

      const res = await fetch('/api/mail', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success('Email sendt');
        setReplying(false);
        setReplyText('');
        setShowCompose(false);
        setCompose({ to: '', subject: '', body: '' });
        await fetchEmails();
      } else {
        toast.error('Kunne ikke sende email — tjek Resend opsætning');
      }
    } finally { setSending(false); }
  };

  const unread = emails.filter(e => !e.read && e.direction === 'inbound').length;

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0F1923', overflow: 'hidden' }}>

      {/* ── Venstre panel: konti + mapper ─────────────────────────────── */}
      <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', background: '#0A1420' }}>

        {/* Ny mail knap */}
        <div style={{ padding: '12px 10px 8px' }}>
          <button
            onClick={() => { setShowCompose(true); setSelectedEmail(null); }}
            style={{ width: '100%', background: '#185FA5', border: 'none', borderRadius: 8, padding: '9px 0', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Pencil size={13} /> Ny mail
          </button>
        </div>

        {/* Mapper */}
        <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[
            { id: 'inbox', label: 'Indbakke', icon: Inbox,         badge: unread },
            { id: 'sent',  label: 'Sendt',    icon: SendHorizonal, badge: 0 },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => { setFolder(f.id as 'inbox' | 'sent'); setSelectedEmail(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', textAlign: 'left',
                background: folder === f.id ? 'rgba(24,95,165,0.18)' : 'transparent',
                color: folder === f.id ? '#ECF0F1' : '#556677',
                fontSize: 13, fontWeight: folder === f.id ? 600 : 400,
              }}
            >
              <f.icon size={14} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{f.label}</span>
              {f.badge > 0 && (
                <span style={{ background: '#185FA5', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{f.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Konti */}
        {accounts.length > 0 && (
          <div style={{ marginTop: 12, padding: '0 6px' }}>
            <div style={{ fontSize: 10, color: '#445566', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 10px 6px' }}>Konti</div>
            <button
              onClick={() => { setActiveAccount(null); setSelectedEmail(null); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: !activeAccount ? 'rgba(24,95,165,0.12)' : 'transparent', color: !activeAccount ? '#ECF0F1' : '#556677', fontSize: 12 }}
            >
              Alle konti
            </button>
            {accounts.map(acc => (
              <button
                key={acc.id}
                onClick={() => { setActiveAccount(acc.id); setSelectedEmail(null); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: activeAccount === acc.id ? 'rgba(24,95,165,0.12)' : 'transparent', color: activeAccount === acc.id ? '#ECF0F1' : '#556677', fontSize: 12 }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: acc.active ? '#2ECC71' : '#445566', flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{acc.name}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Sync */}
        <div style={{ padding: '10px 10px 12px' }}>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 0', borderRadius: 7, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#445566', fontSize: 12, cursor: 'pointer' }}
          >
            <RefreshCw size={12} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            {syncing ? 'Synkroniserer...' : 'Synkroniser'}
          </button>
        </div>
      </div>

      {/* ── Midterste panel: email-liste ─────────────────────────────── */}
      <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#ECF0F1' }}>
            {folder === 'inbox' ? 'Indbakke' : 'Sendt'}
            {unread > 0 && folder === 'inbox' && <span style={{ marginLeft: 8, fontSize: 11, color: '#185FA5', fontWeight: 700 }}>{unread} ulæste</span>}
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {accounts.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#445566' }}>
              <Inbox size={32} style={{ marginBottom: 8, opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
              <div style={{ fontSize: 13 }}>Ingen email-konti</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>
                Gå til <a href="/settings" style={{ color: '#185FA5' }}>Indstillinger</a> og tilføj IMAP-konti
              </div>
            </div>
          ) : emails.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#445566', fontSize: 13 }}>Ingen emails endnu</div>
          ) : (
            emails.map(email => {
              const isSelected = selectedEmail?.id === email.id;
              const displayName = email.direction === 'inbound'
                ? (email.lead_company || email.customer_company || email.from_name || email.from_email)
                : (email.to_email);
              return (
                <button
                  key={email.id}
                  onClick={() => openEmail(email)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '11px 14px', border: 'none', cursor: 'pointer',
                    background: isSelected ? 'rgba(24,95,165,0.15)' : 'transparent',
                    borderLeft: isSelected ? '2px solid #185FA5' : '2px solid transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                  }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(24,95,165,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#185FA5', flexShrink: 0 }}>
                    {(String(displayName || '?')[0]).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: !email.read && email.direction === 'inbound' ? 700 : 500, color: '#ECF0F1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                        {displayName}
                      </span>
                      <span style={{ fontSize: 10, color: '#445566', flexShrink: 0 }}>{timeStr(email.received_at)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: !email.read && email.direction === 'inbound' ? '#8899AA' : '#556677', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {email.subject || '(Intet emne)'}
                    </div>
                    <div style={{ fontSize: 11, color: '#334455', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                      {email.preview?.replace(/\n/g, ' ')}
                    </div>
                  </div>
                  {!email.read && email.direction === 'inbound' && (
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#185FA5', flexShrink: 0, marginTop: 4 }} />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Højre panel: email-detalje / skriv ny ──────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Skriv ny mail */}
        {showCompose && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#ECF0F1' }}>Ny mail</span>
              <button onClick={() => setShowCompose(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#445566', padding: 4 }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 600 }}>
              {accounts.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: '#556677', width: 60 }}>Fra</span>
                  <select value={activeAccount || ''} onChange={e => setActiveAccount(e.target.value || null)} style={{ flex: 1, background: '#111E2A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#ECF0F1', fontSize: 12, padding: '8px 10px', outline: 'none' }}>
                    <option value="">Standard konto</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.email})</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: '#556677', width: 60 }}>Til</span>
                <input value={compose.to} onChange={e => setCompose(p => ({ ...p, to: e.target.value }))} placeholder="modtager@email.dk" style={{ flex: 1, background: '#111E2A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#ECF0F1', fontSize: 13, padding: '8px 12px', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: '#556677', width: 60 }}>Emne</span>
                <input value={compose.subject} onChange={e => setCompose(p => ({ ...p, subject: e.target.value }))} placeholder="Emne" style={{ flex: 1, background: '#111E2A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#ECF0F1', fontSize: 13, padding: '8px 12px', outline: 'none' }} />
              </div>
              <textarea value={compose.body} onChange={e => setCompose(p => ({ ...p, body: e.target.value }))} placeholder="Skriv din besked her..." rows={12} style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#ECF0F1', fontSize: 13, padding: '12px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
              <button onClick={() => handleSend(false)} disabled={!compose.to || !compose.body || sending} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, background: compose.to && compose.body && !sending ? '#185FA5' : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, padding: '10px 20px', color: compose.to && compose.body && !sending ? '#fff' : '#445566', fontSize: 13, fontWeight: 600, cursor: compose.to && compose.body && !sending ? 'pointer' : 'not-allowed' }}>
                <Send size={13} /> {sending ? 'Sender...' : 'Send'}
              </button>
            </div>
          </div>
        )}

        {/* Email detalje */}
        {selectedEmail && !showCompose && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: '#ECF0F1' }}>{selectedEmail.subject || '(Intet emne)'}</h2>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#667788' }}>
                      <span style={{ color: '#445566' }}>Fra: </span>
                      {selectedEmail.from_name ? `${selectedEmail.from_name} <${selectedEmail.from_email}>` : selectedEmail.from_email}
                    </span>
                    <span style={{ fontSize: 12, color: '#667788' }}>
                      <span style={{ color: '#445566' }}>Til: </span>{selectedEmail.to_email}
                    </span>
                    <span style={{ fontSize: 12, color: '#445566' }}>
                      {new Date(selectedEmail.received_at).toLocaleString('da-DK', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {(selectedEmail.lead_company || selectedEmail.customer_company) && (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                      <User size={11} style={{ color: '#185FA5' }} />
                      <span style={{ color: '#185FA5' }}>{selectedEmail.lead_company || selectedEmail.customer_company}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { setReplying(true); setTimeout(() => replyRef.current?.focus(), 50); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(24,95,165,0.15)', border: '1px solid rgba(24,95,165,0.3)', borderRadius: 7, padding: '7px 14px', color: '#185FA5', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
                >
                  <ArrowLeft size={12} /> Svar
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              <div style={{ fontSize: 14, color: '#B0C4D8', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxWidth: 680 }}>
                {selectedEmail.body_text || '(Ingen indhold)'}
              </div>
            </div>

            {/* Svar-boks */}
            {replying && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 24px', background: '#0A1420' }}>
                <div style={{ fontSize: 12, color: '#445566', marginBottom: 8 }}>
                  Svar til <span style={{ color: '#8899AA' }}>{selectedEmail.from_email}</span>
                </div>
                <textarea
                  ref={replyRef}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Skriv dit svar..."
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(true); }}
                  rows={5}
                  style={{ width: '100%', background: '#111E2A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#ECF0F1', fontSize: 13, padding: 12, outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => handleSend(true)} disabled={!replyText.trim() || sending} style={{ display: 'flex', alignItems: 'center', gap: 6, background: replyText.trim() && !sending ? '#185FA5' : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 7, padding: '8px 16px', color: replyText.trim() && !sending ? '#fff' : '#445566', fontSize: 13, fontWeight: 600, cursor: replyText.trim() && !sending ? 'pointer' : 'not-allowed' }}>
                    <Send size={13} /> {sending ? 'Sender...' : 'Send svar'}
                  </button>
                  <button onClick={() => setReplying(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '8px 14px', color: '#445566', fontSize: 13, cursor: 'pointer' }}>Annuller</button>
                  <span style={{ fontSize: 11, color: '#334455', alignSelf: 'center', marginLeft: 4 }}>⌘ + Enter for at sende</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tom tilstand */}
        {!selectedEmail && !showCompose && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#334455', gap: 8 }}>
            <Inbox size={40} style={{ opacity: 0.2 }} />
            <div style={{ fontSize: 14 }}>Vælg en email</div>
            <div style={{ fontSize: 11 }}>eller klik Ny mail for at sende</div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
