'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw, Send, Pencil, Inbox, SendHorizonal, X,
  Star, Trash2, Search, CheckSquare, Square, MailOpen,
  Mail as MailIcon, ChevronDown, ChevronUp, Reply,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Email {
  id: string;
  direction: 'inbound' | 'outbound';
  from_email: string;
  from_name: string | null;
  to_email: string;
  to_name: string | null;
  subject: string | null;
  preview?: string;
  body_text?: string;
  body_html?: string;
  read: boolean;
  starred: boolean;
  draft: boolean;
  received_at: string;
  lead_id?: string | null;
  customer_id?: string | null;
  lead_company?: string | null;
  customer_company?: string | null;
  account_name?: string | null;
  account_email?: string | null;
  imap_account_id?: string;
  thread_id?: string | null;
  message_id?: string | null;
  in_reply_to?: string | null;
}

interface Account {
  id: string;
  name: string;
  email: string;
  active: boolean;
  last_sync: string | null;
}

// ─── Design helpers ───────────────────────────────────────────────────────────
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
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffffff;
  return BADGE_COLORS[h % BADGE_COLORS.length];
}
function timeStr(iso: string) {
  const d = new Date(iso), now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
  if (diffDays < 7)  return d.toLocaleDateString('da-DK', { weekday: 'short' });
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}
function initials(name: string | null, email: string) {
  if (name) return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

type Folder = 'inbox' | 'sent' | 'drafts' | 'starred' | 'all';

const FOLDERS: { id: Folder; label: string; icon: React.ElementType }[] = [
  { id: 'inbox',   label: 'Indbakke',        icon: Inbox         },
  { id: 'sent',    label: 'Sendt',           icon: SendHorizonal  },
  { id: 'drafts',  label: 'Kladder',         icon: Pencil        },
  { id: 'starred', label: 'Stjernemarkeret', icon: Star          },
  { id: 'all',     label: 'Alle mails',      icon: MailIcon      },
];

// ─── Sanitize HTML for iframe ─────────────────────────────────────────────────
function safeHtml(html: string) {
  // Remove script tags and dangerous attributes
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
}

// ─── Thread message collapsed/expanded ───────────────────────────────────────
function ThreadMessage({
  msg, isLast, onReply, onToggleStar,
}: {
  msg: Email; isLast: boolean;
  onReply: () => void;
  onToggleStar: (id: string, starred: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(isLast);
  const [showHtml, setShowHtml]   = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const co = msg.lead_company || msg.customer_company;
  const color = badgeColor(co || msg.from_name || msg.from_email);

  // Resize iframe to content
  useEffect(() => {
    if (showHtml && msg.body_html && iframeRef.current) {
      const iframe = iframeRef.current;
      const onLoad = () => {
        try {
          const h = iframe.contentDocument?.body?.scrollHeight || 400;
          iframe.style.height = `${h + 20}px`;
        } catch { iframe.style.height = '500px'; }
      };
      iframe.addEventListener('load', onLoad);
      return () => iframe.removeEventListener('load', onLoad);
    }
  }, [showHtml, msg.body_html]);

  return (
    <div style={{
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10,
      overflow: 'hidden',
      background: expanded ? '#0C0F14' : '#090C11',
      marginBottom: 10,
    }}>
      {/* Header row — click to expand/collapse */}
      <button
        onClick={() => setExpanded(p => !p)}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
          padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        <div style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: color.text,
        }}>
          {initials(msg.direction === 'inbound' ? msg.from_name : (msg.to_name || null), msg.direction === 'inbound' ? msg.from_email : msg.to_email)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#C8D8E8' }}>
              {msg.direction === 'inbound' ? (msg.from_name || msg.from_email) : `Til: ${msg.to_email}`}
            </span>
            {co && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: color.bg, color: color.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {co}
              </span>
            )}
            {msg.draft && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(241,196,15,0.18)', color: '#F39C12', textTransform: 'uppercase' }}>
                kladde
              </span>
            )}
          </div>
          {!expanded && (
            <div style={{ fontSize: 11, color: '#3A4A5A', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {msg.preview?.replace(/\n/g, ' ') || msg.body_text?.slice(0, 120)}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#2D3748' }}>{timeStr(msg.received_at)}</span>
          <button
            onClick={e => { e.stopPropagation(); onToggleStar(msg.id, msg.starred); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: msg.starred ? '#F39C12' : '#2D3748', padding: 2 }}
          >
            <Star size={13} fill={msg.starred ? '#F39C12' : 'none'} />
          </button>
          {expanded ? <ChevronUp size={14} color="#2D3748" /> : <ChevronDown size={14} color="#2D3748" />}
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {/* From / To meta */}
          <div style={{ padding: '8px 18px 6px', fontSize: 11, color: '#3A4A5A' }}>
            <span>Fra: <span style={{ color: '#556677' }}>{msg.from_email}</span></span>
            <span style={{ marginLeft: 14 }}>Til: <span style={{ color: '#556677' }}>{msg.to_email}</span></span>
            <span style={{ marginLeft: 14 }}>{new Date(msg.received_at).toLocaleString('da-DK', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          {/* Toggle html/text */}
          {msg.body_html && (
            <div style={{ padding: '0 18px 6px', display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowHtml(false)}
                style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)', background: !showHtml ? 'rgba(255,255,255,0.07)' : 'transparent', color: !showHtml ? '#AAB8C2' : '#3A4A5A', cursor: 'pointer' }}
              >
                Tekst
              </button>
              <button
                onClick={() => setShowHtml(true)}
                style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)', background: showHtml ? 'rgba(255,255,255,0.07)' : 'transparent', color: showHtml ? '#AAB8C2' : '#3A4A5A', cursor: 'pointer' }}
              >
                HTML
              </button>
            </div>
          )}

          {/* Body content */}
          <div style={{ padding: '0 18px 14px' }}>
            {showHtml && msg.body_html ? (
              <iframe
                ref={iframeRef}
                srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#ccc;background:#0C0F14;margin:0;padding:8px;}a{color:#3498DB;}</style></head><body>${safeHtml(msg.body_html)}</body></html>`}
                style={{ width: '100%', minHeight: 200, border: 'none', borderRadius: 6, background: '#0C0F14' }}
                sandbox="allow-same-origin"
                title="email-html"
              />
            ) : (
              <div style={{ fontSize: 14, color: '#8AACBE', lineHeight: 1.8, whiteSpace: 'pre-wrap', maxWidth: 760 }}>
                {msg.body_text || '(Ingen indhold)'}
              </div>
            )}
          </div>

          {/* Actions */}
          {isLast && (
            <div style={{ padding: '0 18px 14px', display: 'flex', gap: 8 }}>
              <button
                onClick={onReply}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(232,64,37,0.12)', border: '1px solid rgba(232,64,37,0.25)', borderRadius: 7, padding: '7px 16px', color: '#E84025', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                <Reply size={13} /> Svar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MailPage() {
  const [accounts,      setAccounts]      = useState<Account[]>([]);
  const [emails,        setEmails]        = useState<Email[]>([]);
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [thread,        setThread]        = useState<Email[]>([]);
  const [folder,        setFolder]        = useState<Folder>('inbox');
  const [activeAccount, setActiveAccount] = useState<string | null>(null);
  const [composeFrom,   setComposeFrom]   = useState<string>('');
  const [syncing,       setSyncing]       = useState(false);
  const [showCompose,   setShowCompose]   = useState(false);
  const [replying,      setReplying]      = useState(false);
  const [replyText,     setReplyText]     = useState('');
  const [compose,       setCompose]       = useState({ to: '', subject: '', body: '' });
  const [sending,       setSending]       = useState(false);
  const [search,        setSearch]        = useState('');
  const [searchInput,   setSearchInput]   = useState('');
  const [selected,      setSelected]      = useState<Set<string>>(new Set());
  const [unreadCounts,  setUnreadCounts]  = useState<{ total: number; byAccount: Record<string, number> }>({ total: 0, byAccount: {} });
  const replyRef   = useRef<HTMLTextAreaElement>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data fetching ────────────────────────────────────────────────────────
  const fetchAccounts = useCallback(async () => {
    const res = await fetch('/api/imap-accounts');
    if (res.ok) {
      const data: Account[] = await res.json();
      setAccounts(data);
      setComposeFrom(prev => prev || data[0]?.id || '');
    }
  }, []);

  const fetchUnread = useCallback(async () => {
    const res = await fetch('/api/mail/count');
    if (res.ok) setUnreadCounts(await res.json());
  }, []);

  const fetchEmails = useCallback(async () => {
    const params = new URLSearchParams({ folder, limit: '150' });
    if (activeAccount) params.set('account', activeAccount);
    if (search)        params.set('search', search);
    const res = await fetch(`/api/mail?${params}`);
    if (res.ok) setEmails(await res.json());
  }, [folder, activeAccount, search]);

  const openThread = useCallback(async (email: Email) => {
    setSelectedId(email.id);
    setReplying(false);
    setReplyText('');
    setShowCompose(false);

    if (email.thread_id) {
      const res = await fetch(`/api/mail?threadId=${encodeURIComponent(email.thread_id)}`);
      if (res.ok) {
        const msgs: Email[] = await res.json();
        setThread(msgs.length > 0 ? msgs : [email]);
      } else setThread([email]);
    } else {
      // Fetch full single message
      const res = await fetch(`/api/mail?id=${email.id}`);
      if (res.ok) setThread([await res.json()]);
      else setThread([email]);
    }
    // Mark as read in list
    setEmails(prev => prev.map(e => e.id === email.id || e.thread_id === email.thread_id ? { ...e, read: true } : e));
    fetchUnread();
  }, [fetchUnread]);

  // ── Initial load + poll ──────────────────────────────────────────────────
  useEffect(() => {
    fetchAccounts();
    fetchUnread();
  }, [fetchAccounts, fetchUnread]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  // Auto-poll every 60 seconds
  useEffect(() => {
    pollRef.current = setInterval(() => {
      fetchEmails();
      fetchUnread();
    }, 60000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchEmails, fetchUnread]);

  // ── Sync ─────────────────────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res  = await fetch('/api/mail/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        await Promise.all([fetchEmails(), fetchUnread()]);
        toast.success(data.synced > 0 ? `${data.synced} nye emails hentet` : 'Indbakke er opdateret');
      } else {
        toast.error(`Sync fejlede: ${data.error}`);
      }
    } catch (err) {
      toast.error(`Fejl: ${String(err)}`);
    } finally { setSyncing(false); }
  };

  // ── Star toggle (persisted in DB) ────────────────────────────────────────
  const toggleStar = useCallback(async (id: string, currentStarred: boolean) => {
    const action = currentStarred ? 'unstar' : 'star';
    await fetch('/api/mail', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id], action }),
    });
    setEmails(prev => prev.map(e => e.id === id ? { ...e, starred: !currentStarred } : e));
    setThread(prev => prev.map(e => e.id === id ? { ...e, starred: !currentStarred } : e));
  }, []);

  // ── Bulk actions ─────────────────────────────────────────────────────────
  const bulkAction = async (action: string) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    await fetch('/api/mail', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, action }),
    });
    if (action === 'delete') {
      setEmails(prev => prev.filter(e => !selected.has(e.id)));
      if (selectedId && selected.has(selectedId)) { setSelectedId(null); setThread([]); }
    } else if (action === 'read') {
      setEmails(prev => prev.map(e => selected.has(e.id) ? { ...e, read: true } : e));
    } else if (action === 'unread') {
      setEmails(prev => prev.map(e => selected.has(e.id) ? { ...e, read: false } : e));
    } else if (action === 'star') {
      setEmails(prev => prev.map(e => selected.has(e.id) ? { ...e, starred: true } : e));
    }
    setSelected(new Set());
    fetchUnread();
    toast.success('Handling udført');
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Send / reply ─────────────────────────────────────────────────────────
  const handleSend = async (isReply: boolean) => {
    setSending(true);
    try {
      const lastMsg = thread[thread.length - 1];
      const payload = isReply
        ? {
            to: lastMsg.from_email,
            subject: `Re: ${lastMsg.subject || ''}`,
            body: replyText,
            fromAccountId: lastMsg.imap_account_id || composeFrom || null,
            inReplyToId: lastMsg.id,
          }
        : {
            to: compose.to,
            subject: compose.subject,
            body: compose.body,
            fromAccountId: composeFrom || null,
          };

      const res = await fetch('/api/mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  // ── Search ───────────────────────────────────────────────────────────────
  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setSelectedId(null);
    setThread([]);
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const inboxUnread = unreadCounts.total;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', background: '#0C0F14', overflow: 'hidden' }}>

      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      <div style={{
        width: 208, flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        background: '#0A0D12',
      }}>
        {/* Ny mail */}
        <div style={{ padding: '14px 12px 10px' }}>
          <button
            onClick={() => {
              if (activeAccount) setComposeFrom(activeAccount);
              setShowCompose(true);
              setSelectedId(null);
              setThread([]);
            }}
            style={{
              width: '100%', background: '#E84025', border: 'none', borderRadius: 8,
              padding: '9px 0', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            <Pencil size={13} /> Ny mail
          </button>
        </div>

        {/* Folders */}
        <div style={{ padding: '2px 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {FOLDERS.map(f => {
            const isActive = folder === f.id;
            const badge = f.id === 'inbox' ? inboxUnread : 0;
            return (
              <button
                key={f.id}
                onClick={() => { setFolder(f.id); setSelectedId(null); setThread([]); setSearch(''); setSearchInput(''); setSelected(new Set()); }}
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
                  <span style={{ background: '#E84025', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Konti */}
        {accounts.length > 0 && (
          <div style={{ marginTop: 16, padding: '0 8px' }}>
            <div style={{ fontSize: 10, color: '#2D3748', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '2px 10px 8px' }}>
              KONTI
            </div>
            <button
              onClick={() => { setActiveAccount(null); setSelectedId(null); setThread([]); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: !activeAccount ? 'rgba(232,64,37,0.1)' : 'transparent', color: !activeAccount ? '#ECF0F1' : '#4A5568', fontSize: 12 }}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2ECC71', flexShrink: 0 }} />
              <span style={{ flex: 1, textAlign: 'left' }}>Alle konti</span>
              {unreadCounts.total > 0 && !activeAccount && (
                <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(232,64,37,0.2)', color: '#E84025', borderRadius: 8, padding: '1px 5px' }}>{unreadCounts.total}</span>
              )}
            </button>
            {accounts.map(acc => (
              <button
                key={acc.id}
                onClick={() => { setActiveAccount(acc.id); setSelectedId(null); setThread([]); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', background: activeAccount === acc.id ? 'rgba(232,64,37,0.1)' : 'transparent', color: activeAccount === acc.id ? '#ECF0F1' : '#4A5568', fontSize: 12, textAlign: 'left' }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: acc.active ? '#2ECC71' : '#4A5568', flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.name}</span>
                {unreadCounts.byAccount[acc.id] > 0 && (
                  <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(232,64,37,0.2)', color: '#E84025', borderRadius: 8, padding: '1px 5px' }}>
                    {unreadCounts.byAccount[acc.id]}
                  </span>
                )}
              </button>
            ))}
            <a href="/settings" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', color: '#E84025', fontSize: 11, textDecoration: 'none', opacity: 0.7, marginTop: 4 }}>
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

        {/* Sync */}
        <div style={{ padding: '10px 12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 0', borderRadius: 7, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: syncing ? '#E84025' : '#3A4A5A', fontSize: 12, cursor: 'pointer' }}
          >
            <RefreshCw size={12} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            {syncing ? 'Synkroniserer...' : 'Synkroniser'}
          </button>
        </div>
      </div>

      {/* ── Email list ────────────────────────────────────────────────────── */}
      <div style={{
        width: 330, flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', background: '#0C0F14',
      }}>
        {/* Search bar */}
        <form onSubmit={submitSearch} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0A0D12', borderRadius: 8, padding: '7px 11px', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Search size={12} color="#3A4A5A" style={{ flexShrink: 0 }} />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setSearchInput(''); setSearch(''); } }}
              placeholder="Søg i emails..."
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#C0D0E0', fontSize: 12 }}
            />
            {search && (
              <button type="button" onClick={() => { setSearch(''); setSearchInput(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A5568', padding: 0 }}>
                <X size={11} />
              </button>
            )}
          </div>
        </form>

        {/* List header + bulk actions */}
        <div style={{ padding: '6px 12px 6px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 }}>
          {selected.size === 0 ? (
            <>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#8899AA' }}>
                {FOLDERS.find(f => f.id === folder)?.label}
                {search && <span style={{ color: '#E84025', marginLeft: 6 }}>&ldquo;{search}&rdquo;</span>}
              </span>
              {inboxUnread > 0 && folder === 'inbox' && (
                <span style={{ fontSize: 10, color: '#E84025', fontWeight: 700, background: 'rgba(232,64,37,0.12)', padding: '1px 7px', borderRadius: 8 }}>{inboxUnread} ulæste</span>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#667788' }}>{selected.size} valgt</span>
              <button onClick={() => bulkAction('read')}   style={bulkBtn}>Marker læst</button>
              <button onClick={() => bulkAction('unread')} style={bulkBtn}>Ulæst</button>
              <button onClick={() => bulkAction('star')}   style={bulkBtn}>★</button>
              <button onClick={() => bulkAction('delete')} style={{ ...bulkBtn, color: '#E84025' }}>Slet</button>
              <button onClick={() => setSelected(new Set())} style={{ ...bulkBtn, marginLeft: 4 }}><X size={10} /></button>
            </div>
          )}
        </div>

        {/* Email rows */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {emails.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: '#2D3748' }}>
              <Inbox size={32} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.15 }} />
              <div style={{ fontSize: 12 }}>{accounts.length === 0 ? 'Ingen konti opsat' : search ? 'Ingen resultater' : 'Ingen emails'}</div>
            </div>
          ) : (
            emails.map(email => {
              const isSelected = selectedId === email.id;
              const isChecked  = selected.has(email.id);
              const companyName = email.lead_company || email.customer_company || null;
              const displayName = email.direction === 'inbound'
                ? (email.from_name || email.from_email)
                : `Til: ${email.to_email}`;
              const isUnread = !email.read && email.direction === 'inbound';
              const color = badgeColor(companyName || displayName);

              return (
                <div
                  key={email.id}
                  style={{
                    display: 'flex', alignItems: 'stretch',
                    background: isSelected ? 'rgba(232,64,37,0.08)' : 'transparent',
                    borderLeft: isSelected ? '3px solid #E84025' : '3px solid transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                  }}
                  onClick={() => openThread(email)}
                >
                  {/* Checkbox */}
                  <div
                    style={{ width: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={e => { e.stopPropagation(); toggleSelect(email.id); }}
                  >
                    {isChecked
                      ? <CheckSquare size={13} color="#E84025" />
                      : <Square size={13} color="#1E2A38" />
                    }
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, padding: '9px 12px 9px 2px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                    {/* Row 1 */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                        {isUnread && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#E84025', flexShrink: 0 }} />}
                        <span style={{ fontSize: 12, fontWeight: isUnread ? 700 : 500, color: isUnread ? '#ECF0F1' : '#8899AA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {displayName}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                        {email.starred && <Star size={10} color="#F39C12" fill="#F39C12" />}
                        <span style={{ fontSize: 10, color: '#2D3748' }}>{timeStr(email.received_at)}</span>
                      </div>
                    </div>
                    {/* Row 2 */}
                    <div style={{ fontSize: 12, color: isUnread ? '#C0D0E0' : '#4A5568', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {email.subject || '(Intet emne)'}
                      {email.draft && <span style={{ marginLeft: 6, fontSize: 10, color: '#F39C12', fontWeight: 700 }}>KLADDE</span>}
                    </div>
                    {/* Row 3 */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <div style={{ fontSize: 11, color: '#2D3748', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {email.preview?.replace(/\n/g, ' ')}
                      </div>
                      {companyName && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, flexShrink: 0, background: color.bg, color: color.text, textTransform: 'uppercase', letterSpacing: '0.04em', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {companyName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right panel: thread / compose ────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', background: '#0C0F14' }}>

        {/* Compose new */}
        {showCompose && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 32px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: '#ECF0F1' }}>Ny mail</span>
              <button onClick={() => setShowCompose(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A5568' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 680, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
              <FieldRow label="Fra">
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
              </FieldRow>
              <FieldRow label="Til">
                <input value={compose.to} onChange={e => setCompose(p => ({ ...p, to: e.target.value }))} placeholder="modtager@email.dk" style={inputStyle} autoFocus />
              </FieldRow>
              <FieldRow label="Emne">
                <input value={compose.subject} onChange={e => setCompose(p => ({ ...p, subject: e.target.value }))} placeholder="Emne" style={inputStyle} />
              </FieldRow>
              <textarea
                value={compose.body}
                onChange={e => setCompose(p => ({ ...p, body: e.target.value }))}
                placeholder="Skriv din besked her..."
                rows={16}
                style={{ background: 'transparent', border: 'none', color: '#B0C4D8', fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.7, padding: '14px 16px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                onClick={() => handleSend(false)}
                disabled={!compose.to || !compose.body || !composeFrom || sending}
                style={sendBtnStyle(!compose.to || !compose.body || !composeFrom || sending)}
              >
                <Send size={13} /> {sending ? 'Sender...' : 'Send'}
              </button>
              <button onClick={() => setShowCompose(false)} style={cancelBtnStyle}>Annuller</button>
            </div>
          </div>
        )}

        {/* Thread view */}
        {!showCompose && selectedId && thread.length > 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Subject header */}
            <div style={{ padding: '16px 24px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#ECF0F1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {thread[0]?.subject || '(Intet emne)'}
                </h2>
                <div style={{ fontSize: 11, color: '#3A4A5A', marginTop: 3 }}>
                  {thread.length} besked{thread.length !== 1 ? 'er' : ''} i tråden
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => toggleStar(thread[thread.length - 1].id, thread[thread.length - 1].starred)}
                  style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '6px 8px', cursor: 'pointer', color: thread[thread.length - 1].starred ? '#F39C12' : '#3A4A5A' }}
                >
                  <Star size={14} fill={thread[thread.length - 1].starred ? '#F39C12' : 'none'} />
                </button>
                <button
                  onClick={async () => {
                    const ids = thread.map(m => m.id);
                    await fetch('/api/mail', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, action: 'delete' }) });
                    setEmails(prev => prev.filter(e => !ids.includes(e.id)));
                    setSelectedId(null); setThread([]);
                    toast.success('Slettet');
                  }}
                  style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '6px 8px', cursor: 'pointer', color: '#3A4A5A' }}
                >
                  <Trash2 size={14} />
                </button>
                <button
                  onClick={() => { setReplying(true); setTimeout(() => replyRef.current?.focus(), 50); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(232,64,37,0.12)', border: '1px solid rgba(232,64,37,0.25)', borderRadius: 7, padding: '7px 16px', color: '#E84025', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  <Reply size={13} /> Svar
                </button>
              </div>
            </div>

            {/* Thread messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {thread.map((msg, i) => (
                <ThreadMessage
                  key={msg.id}
                  msg={msg}
                  isLast={i === thread.length - 1}
                  onReply={() => { setReplying(true); setTimeout(() => replyRef.current?.focus(), 50); }}
                  onToggleStar={toggleStar}
                />
              ))}
            </div>

            {/* Reply box */}
            {replying && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 24px 18px', background: '#090C11', flexShrink: 0 }}>
                <div style={{ fontSize: 12, color: '#3A4A5A', marginBottom: 8 }}>
                  Svar til <span style={{ color: '#667788' }}>{thread[thread.length - 1].from_email}</span>
                  <span style={{ marginLeft: 10, color: '#2D3748' }}>via {thread[thread.length - 1].account_name || thread[thread.length - 1].account_email || ''}</span>
                </div>
                <textarea
                  ref={replyRef}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Skriv dit svar..."
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(true); }}
                  rows={6}
                  style={{ width: '100%', background: '#0F1420', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#ECF0F1', fontSize: 13, padding: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' }}
                />
                {/* Quote preview */}
                <div style={{ fontSize: 11, color: '#2D3748', margin: '6px 0 10px', paddingLeft: 12, borderLeft: '2px solid rgba(255,255,255,0.07)' }}>
                  {thread[thread.length - 1].body_text?.slice(0, 200).replace(/\n/g, ' ')}...
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={() => handleSend(true)} disabled={!replyText.trim() || sending} style={sendBtnStyle(!replyText.trim() || sending)}>
                    <Send size={13} /> {sending ? 'Sender...' : 'Send svar'}
                  </button>
                  <button onClick={() => setReplying(false)} style={cancelBtnStyle}>Annuller</button>
                  <span style={{ fontSize: 11, color: '#1E2A38', marginLeft: 4 }}>⌘+Enter for at sende</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!showCompose && !selectedId && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#1E2A38', gap: 10 }}>
            <MailOpen size={48} style={{ opacity: 0.12 }} />
            <div style={{ fontSize: 15, color: '#2D3748' }}>Vælg en email</div>
            <div style={{ fontSize: 12, color: '#1E2A38' }}>eller klik Ny mail for at skrive</div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
      `}</style>
    </div>
  );
}

// ─── Small shared sub-components ─────────────────────────────────────────────
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: 12, color: '#4A5568', width: 44, flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1, background: 'transparent', border: 'none', color: '#ECF0F1', fontSize: 13, outline: 'none',
};
const sendBtnStyle = (disabled: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 6,
  background: disabled ? 'rgba(255,255,255,0.06)' : '#E84025',
  border: 'none', borderRadius: 8, padding: '9px 20px',
  color: disabled ? '#3A4A5A' : '#fff', fontSize: 13, fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
});
const cancelBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8, padding: '9px 16px', color: '#4A5568', fontSize: 13, cursor: 'pointer',
};
const bulkBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 5, padding: '3px 8px', color: '#667788', fontSize: 11, cursor: 'pointer',
};
