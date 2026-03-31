'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Send, Pencil, Inbox, SendHorizonal, X, ArrowLeft, Star, Trash2, Archive, AlertCircle } from 'lucide-react';
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

// Palette of badge colors for companies
const BADGE_COLORS = [
  { bg: 'rgba(232,64,37,0.18)',   text: '#E84025' },
  { bg: 'rgba(52,152,219,0.18)',  text: '#3498DB' },
  { bg: 'rgba(46,204,113,0.18)',  text: '#27AE60' },
  { bg: 'rgba(155,89,182,0.18)',  text: '#9B59B6' },
  { bg: 'rgba(230,126,34,0.18)',  text: '#E67E22' },
  { bg: 'rgba(26,188,156,0.18)',  text: '#1ABC9C' },
  { bg: 'rgba(241,196,15,0.18)',  text: '#F39C12' },
  { bg: 'rgba(231,76,60,0.18)',   text: '#C0392B' },
];

function badgeColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xfffffff;
  return BADGE_COLORS[hash % BADGE_COLORS.length];
}

function timeStr(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
  if (diffDays < 7)  return d.toLocaleDateString('da-DK', { weekday: 'short' });
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

type Folder = 'inbox' | 'sent' | 'drafts' | 'starred' | 'spam' | 'trash';

const FOLDERS: { id: Folder; label: string; icon: React.ElementType }[] = [
  { id: 'inbox',   label: 'Indbakke',       icon: Inbox },
  { id: 'sent',    label: 'Sendt',          icon: SendHorizonal },
  { id: 'drafts',  label: 'Kladder',        icon: Pencil },
  { id: 'starred', label: 'Stjernemarkeret', icon: Star },
  { id: 'spam',    label: 'Spam',           icon: AlertCircle },
  { id: 'trash',   label: 'Papirkurv',      icon: Trash2 },
];

export default function MailPage() {
  const [accounts,       setAccounts]       = useState<Account[]>([]);
  const [emails,         setEmails]         = useState<Email[]>([]);
  const [selectedEmail,  setSelectedEmail]  = useState<Email | null>(null);
  const [folder,         setFolder]         = useState<Folder>('inbox');
  const [activeAccount,  setActiveAccount]  = useState<string | null>(null); // filter: hvilken indbakke
  const [composeFrom,    setComposeFrom]    = useState<string>('');           // afsenderkonto i compose
  const [syncing,        setSyncing]        = useState(false);
  const [showCompose,    setShowCompose]    = useState(false);
  const [replying,       setReplying]       = useState(false);
  const [replyText,      setReplyText]      = useState('');
  const [compose,        setCompose]        = useState({ to: '', subject: '', body: '' });
  const [sending,        setSending]        = useState(false);
  const [starred,        setStarred]        = useState<Set<string>>(new Set());
  const replyRef = useRef<HTMLTextAreaElement>(null);

  // Sæt composeFrom til første konto når konti loades (kun én gang)
  useEffect(() => {
    if (accounts.length > 0 && !composeFrom) {
      setComposeFrom(accounts[0].id);
    }
  }, [accounts, composeFrom]);

  const fetchAccounts = useCallback(async () => {
    const res = await fetch('/api/imap-accounts');
    if (res.ok) setAccounts(await res.json());
  }, []);

  const fetchEmails = useCallback(async () => {
    // Map visual folder to API folder param
    const apiFolder = folder === 'sent' ? 'sent' : 'inbox';
    const params = new URLSearchParams({ folder: apiFolder });
    if (activeAccount) params.set('account', activeAccount);
    const res = await fetch(`/api/mail?${params}`);
    if (res.ok) {
      let data: Email[] = await res.json();
      // Client-side filtering for special folders
      if (folder === 'starred') data = data.filter(e => starred.has(e.id));
      setEmails(data);
    }
  }, [folder, activeAccount, starred]);

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
      const res = await fetch('/api/mail/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        await fetchEmails();
        toast.success(data.synced > 0 ? `${data.synced} nye emails hentet` : 'Indbakke er opdateret');
      } else {
        toast.error(`Synkronisering fejlede: ${data.error}`);
      }
    } catch (err) {
      toast.error(`Fejl: ${String(err)}`);
    } finally { setSyncing(false); }
  };

  const handleSend = async (isReply: boolean) => {
    setSending(true);
    try {
      const body = isReply
        ? { to: selectedEmail!.from_email, subject: `Re: ${selectedEmail!.subject || ''}`, body: replyText, fromAccountId: selectedEmail?.imap_account_id || composeFrom || null, inReplyToId: selectedEmail!.id }
        : { to: compose.to, subject: compose.subject, body: compose.body, fromAccountId: composeFrom || null };

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
        const errData = await res.json().catch(() => ({ error: 'Ukendt fejl' }));
        toast.error(errData.error || 'Kunne ikke sende email');
      }
    } finally { setSending(false); }
  };

  const toggleStar = (id: string) => {
    setStarred(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const unread = emails.filter(e => !e.read && e.direction === 'inbound').length;

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0C0F14', overflow: 'hidden' }}>

      {/* ── Venstre panel: mapper + konti ─────────────────────────────── */}
      <div style={{ width: 210, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', background: '#0A0D12' }}>

        {/* Ny mail knap */}
        <div style={{ padding: '14px 12px 10px' }}>
          <button
            onClick={() => {
              // Præ-vælg den konto man kigger i (eller første konto)
              if (activeAccount) setComposeFrom(activeAccount);
              else if (accounts.length > 0 && !composeFrom) setComposeFrom(accounts[0].id);
              setShowCompose(true);
              setSelectedEmail(null);
            }}
            style={{ width: '100%', background: '#E84025', border: 'none', borderRadius: 8, padding: '9px 0', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
          >
            <Pencil size={13} /> Ny mail
          </button>
        </div>

        {/* Mapper */}
        <div style={{ padding: '2px 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {FOLDERS.map(f => {
            const isActive = folder === f.id;
            const badge = f.id === 'inbox' ? unread : 0;
            return (
              <button
                key={f.id}
                onClick={() => { setFolder(f.id); setSelectedEmail(null); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 7,
                  border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                  background: isActive ? 'rgba(232,64,37,0.16)' : 'transparent',
                  color: isActive ? '#ECF0F1' : '#4A5568',
                  fontSize: 13, fontWeight: isActive ? 600 : 400,
                }}
              >
                <f.icon size={14} style={{ flexShrink: 0, color: isActive ? '#E84025' : '#4A5568' }} />
                <span style={{ flex: 1 }}>{f.label}</span>
                {badge > 0 && (
                  <span style={{ background: '#E84025', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{badge}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Konti */}
        {accounts.length > 0 && (
          <div style={{ marginTop: 16, padding: '0 8px' }}>
            <div style={{ fontSize: 10, color: '#2D3748', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '2px 10px 8px' }}>KONTI</div>
            <button
              onClick={() => { setActiveAccount(null); setSelectedEmail(null); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: !activeAccount ? 'rgba(232,64,37,0.1)' : 'transparent', color: !activeAccount ? '#ECF0F1' : '#4A5568', fontSize: 12 }}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2ECC71', flexShrink: 0 }} />
              <span>Alle konti</span>
            </button>
            {accounts.map(acc => (
              <button
                key={acc.id}
                onClick={() => { setActiveAccount(acc.id); setSelectedEmail(null); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: activeAccount === acc.id ? 'rgba(232,64,37,0.1)' : 'transparent', color: activeAccount === acc.id ? '#ECF0F1' : '#4A5568', fontSize: 12, textAlign: 'left' }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: acc.active ? '#2ECC71' : '#4A5568', flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{acc.name}</span>
              </button>
            ))}
            <a
              href="/settings"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', color: '#E84025', fontSize: 11, textDecoration: 'none', opacity: 0.7, marginTop: 4 }}
            >
              + Tilføj konto
            </a>
          </div>
        )}

        {accounts.length === 0 && (
          <div style={{ padding: '12px 12px 0', fontSize: 11, color: '#2D3748', lineHeight: 1.5 }}>
            <a href="/settings" style={{ color: '#E84025', textDecoration: 'none' }}>Tilføj IMAP-konto</a>{' '}
            i indstillinger for at modtage emails
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Sync + Test SMTP */}
        <div style={{ padding: '10px 12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 0', borderRadius: 7, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: '#3A4A5A', fontSize: 12, cursor: 'pointer' }}
          >
            <RefreshCw size={12} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none', color: syncing ? '#E84025' : undefined }} />
            {syncing ? 'Synkroniserer...' : 'Synkroniser'}
          </button>
          <button
            onClick={async () => {
              const res = await fetch('/api/mail/test-smtp', { method: 'POST' });
              const data = await res.json();
              if (data.results) {
                data.results.forEach((r: { account: string; ok: boolean; smtp_host?: string; smtp_user?: string; error?: string }) => {
                  if (r.ok) toast.success(`${r.account}: SMTP OK (${r.smtp_host})`);
                  else toast.error(`${r.account}: ${r.error || 'Fejl'} — host: ${r.smtp_host || 'mangler'}, user: ${r.smtp_user || 'mangler'}`);
                });
              } else {
                toast.error(data.error || 'Ukendt fejl');
              }
            }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '6px 0', borderRadius: 7, border: '1px solid rgba(255,255,255,0.05)', background: 'transparent', color: '#2D3748', fontSize: 11, cursor: 'pointer' }}
          >
            Test SMTP
          </button>
        </div>
      </div>

      {/* ── Midterste panel: email-liste ─────────────────────────────── */}
      <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0C0F14' }}>
        {/* Header */}
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: '#ECF0F1' }}>
              {FOLDERS.find(f => f.id === folder)?.label || 'Indbakke'}
            </span>
            {unread > 0 && folder === 'inbox' && (
              <span style={{ fontSize: 11, color: '#E84025', fontWeight: 700, background: 'rgba(232,64,37,0.12)', padding: '2px 8px', borderRadius: 10 }}>{unread} ulæste</span>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {accounts.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: '#2D3748' }}>
              <Inbox size={32} style={{ marginBottom: 10, opacity: 0.2, display: 'block', margin: '0 auto 10px' }} />
              <div style={{ fontSize: 13, color: '#4A5568' }}>Ingen email-konti opsat</div>
              <div style={{ fontSize: 11, marginTop: 6, color: '#2D3748' }}>
                <a href="/settings" style={{ color: '#E84025' }}>Gå til Indstillinger</a> og tilsæt IMAP
              </div>
            </div>
          ) : emails.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: '#2D3748', fontSize: 13 }}>
              <Archive size={28} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.2 }} />
              Ingen emails i denne mappe
            </div>
          ) : (
            emails.map(email => {
              const isSelected = selectedEmail?.id === email.id;
              const companyName = email.direction === 'inbound'
                ? (email.lead_company || email.customer_company || null)
                : null;
              const displayName = email.direction === 'inbound'
                ? (email.from_name || email.from_email)
                : email.to_email;
              const isUnread = !email.read && email.direction === 'inbound';
              const color = badgeColor(companyName || displayName);

              return (
                <button
                  key={email.id}
                  onClick={() => openEmail(email)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 14px 10px 12px',
                    border: 'none', cursor: 'pointer',
                    background: isSelected ? 'rgba(232,64,37,0.1)' : 'transparent',
                    borderLeft: isSelected ? '3px solid #E84025' : '3px solid transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    display: 'flex', flexDirection: 'column', gap: 5,
                  }}
                >
                  {/* Row 1: name + time */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }}>
                      {isUnread && (
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#E84025', flexShrink: 0 }} />
                      )}
                      <span style={{ fontSize: 12, fontWeight: isUnread ? 700 : 500, color: isUnread ? '#ECF0F1' : '#8899AA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {displayName}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: '#2D3748', flexShrink: 0 }}>{timeStr(email.received_at)}</span>
                  </div>

                  {/* Row 2: subject */}
                  <div style={{ fontSize: 12, color: isUnread ? '#C0D0E0' : '#4A5568', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: isUnread ? 14 : 0 }}>
                    {email.subject || '(Intet emne)'}
                  </div>

                  {/* Row 3: preview + company badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, paddingLeft: isUnread ? 14 : 0 }}>
                    <div style={{ fontSize: 11, color: '#2D3748', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {email.preview?.replace(/\n/g, ' ')}
                    </div>
                    {companyName && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 5, flexShrink: 0,
                        background: color.bg, color: color.text, textTransform: 'uppercase', letterSpacing: '0.04em',
                        whiteSpace: 'nowrap', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {companyName}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Højre panel: email-detalje / skriv ny ──────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', background: '#0C0F14' }}>

        {/* Skriv ny mail */}
        {showCompose && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: '#ECF0F1' }}>Ny mail</span>
              <button onClick={() => setShowCompose(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A5568', padding: 4 }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 640, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
              {/* Fra — altid synlig, vælg afsenderkonto */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 12, color: '#4A5568', width: 44, flexShrink: 0 }}>Fra</span>
                <select
                  value={composeFrom}
                  onChange={e => setComposeFrom(e.target.value)}
                  style={{ flex: 1, background: 'transparent', border: 'none', color: '#ECF0F1', fontSize: 13, outline: 'none', cursor: 'pointer' }}
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id} style={{ background: '#111820' }}>{a.name} — {a.email}</option>
                  ))}
                  {accounts.length === 0 && <option value="">Ingen konti opsat</option>}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 12, color: '#4A5568', width: 44, flexShrink: 0 }}>Til</span>
                <input value={compose.to} onChange={e => setCompose(p => ({ ...p, to: e.target.value }))} placeholder="modtager@email.dk" style={{ flex: 1, background: 'transparent', border: 'none', color: '#ECF0F1', fontSize: 13, outline: 'none' }} autoFocus />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: 12, color: '#4A5568', width: 44, flexShrink: 0 }}>Emne</span>
                <input value={compose.subject} onChange={e => setCompose(p => ({ ...p, subject: e.target.value }))} placeholder="Emne" style={{ flex: 1, background: 'transparent', border: 'none', color: '#ECF0F1', fontSize: 13, outline: 'none' }} />
              </div>
              <textarea value={compose.body} onChange={e => setCompose(p => ({ ...p, body: e.target.value }))} placeholder="Skriv din besked her..." rows={14} style={{ background: 'transparent', border: 'none', color: '#B0C4D8', fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.7, padding: '12px 14px' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => handleSend(false)} disabled={!compose.to || !compose.body || !composeFrom || sending} style={{ display: 'flex', alignItems: 'center', gap: 6, background: compose.to && compose.body && composeFrom && !sending ? '#E84025' : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, padding: '9px 20px', color: compose.to && compose.body && composeFrom && !sending ? '#fff' : '#3A4A5A', fontSize: 13, fontWeight: 600, cursor: compose.to && compose.body && composeFrom && !sending ? 'pointer' : 'not-allowed' }}>
                <Send size={13} /> {sending ? 'Sender...' : 'Send'}
              </button>
              <button onClick={() => setShowCompose(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '9px 16px', color: '#4A5568', fontSize: 13, cursor: 'pointer' }}>Annuller</button>
            </div>
          </div>
        )}

        {/* Email detalje */}
        {selectedEmail && !showCompose && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '18px 28px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 600, color: '#ECF0F1', lineHeight: 1.3 }}>
                {selectedEmail.subject || '(Intet emne)'}
              </h2>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
                  {/* Avatar */}
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: badgeColor(selectedEmail.from_name || selectedEmail.from_email).bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 700,
                    color: badgeColor(selectedEmail.from_name || selectedEmail.from_email).text,
                  }}>
                    {(selectedEmail.from_name || selectedEmail.from_email)[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#ECF0F1' }}>
                        {selectedEmail.from_name || selectedEmail.from_email}
                      </span>
                      {(selectedEmail.lead_company || selectedEmail.customer_company) && (() => {
                        const co = (selectedEmail.lead_company || selectedEmail.customer_company)!;
                        const c = badgeColor(co);
                        return (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: c.bg, color: c.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {co}
                          </span>
                        );
                      })()}
                    </div>
                    <div style={{ fontSize: 11, color: '#3A4A5A', marginTop: 3 }}>
                      {selectedEmail.from_email !== (selectedEmail.from_name || '') && (
                        <span>{selectedEmail.from_email} → </span>
                      )}
                      {selectedEmail.to_email}
                      <span style={{ marginLeft: 10 }}>
                        {new Date(selectedEmail.received_at).toLocaleString('da-DK', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                  <button
                    onClick={() => toggleStar(selectedEmail.id)}
                    style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '6px 8px', cursor: 'pointer', color: starred.has(selectedEmail.id) ? '#F39C12' : '#3A4A5A' }}
                    title="Stjernemarkér"
                  >
                    <Star size={14} fill={starred.has(selectedEmail.id) ? '#F39C12' : 'none'} />
                  </button>
                  <button
                    onClick={() => { setReplying(true); setTimeout(() => replyRef.current?.focus(), 50); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(232,64,37,0.12)', border: '1px solid rgba(232,64,37,0.25)', borderRadius: 7, padding: '7px 16px', color: '#E84025', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    <ArrowLeft size={13} /> Svar
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px' }}>
              <div style={{ fontSize: 14, color: '#9AAFBF', lineHeight: 1.75, whiteSpace: 'pre-wrap', maxWidth: 700 }}>
                {selectedEmail.body_text || '(Ingen indhold)'}
              </div>
            </div>

            {/* Svar-boks */}
            {replying && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px 28px', background: '#090C11' }}>
                <div style={{ fontSize: 12, color: '#3A4A5A', marginBottom: 8 }}>
                  Svar til <span style={{ color: '#667788' }}>{selectedEmail.from_email}</span>
                </div>
                <textarea
                  ref={replyRef}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Skriv dit svar..."
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(true); }}
                  rows={5}
                  style={{ width: '100%', background: '#0F1420', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#ECF0F1', fontSize: 13, padding: 12, outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => handleSend(true)} disabled={!replyText.trim() || sending} style={{ display: 'flex', alignItems: 'center', gap: 6, background: replyText.trim() && !sending ? '#E84025' : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 7, padding: '8px 18px', color: replyText.trim() && !sending ? '#fff' : '#3A4A5A', fontSize: 13, fontWeight: 600, cursor: replyText.trim() && !sending ? 'pointer' : 'not-allowed' }}>
                    <Send size={13} /> {sending ? 'Sender...' : 'Send svar'}
                  </button>
                  <button onClick={() => setReplying(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 7, padding: '8px 14px', color: '#3A4A5A', fontSize: 13, cursor: 'pointer' }}>Annuller</button>
                  <span style={{ fontSize: 11, color: '#1E2A38', alignSelf: 'center', marginLeft: 4 }}>⌘ + Enter for at sende</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tom tilstand */}
        {!selectedEmail && !showCompose && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#1E2A38', gap: 10 }}>
            <Inbox size={48} style={{ opacity: 0.15 }} />
            <div style={{ fontSize: 15, color: '#2D3748' }}>Vælg en email</div>
            <div style={{ fontSize: 12, color: '#1E2A38' }}>eller klik Ny mail for at skrive</div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
