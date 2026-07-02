'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CompanyProvider, useCompany } from '@/lib/company-context';
import type { CompanySlug } from '@/lib/company-context';

interface NavItem  { href: string; label: string; icon: React.ReactNode; section?: string; adminOnly?: boolean }
interface NavGroup { group: true; label: string; icon: React.ReactNode; adminOnly?: boolean; children: NavItem[] }
type NavEntry = NavItem | NavGroup

function isGroup(e: NavEntry): e is NavGroup { return 'group' in e && e.group === true; }

/* ── Company metadata ───────────────────────────────── */
const COMPANY_META: Record<CompanySlug, { name: string; short: string; color: string }> = {
  nls:         { name: 'NextLevel Sales',            short: 'NLS',  color: 'var(--bl)' },
  meridian:    { name: 'Meridian',                   short: 'MD',   color: 'var(--gr)' },
  quorex:      { name: 'Quorex',                     short: 'QX',   color: 'var(--pu)' },
  reminder:    { name: 'BusyReminder',               short: 'BR',   color: 'var(--ye)' },
  group:       { name: 'NL Group',                   short: 'GRP',  color: 'var(--t2)' },
  creatorrate: { name: 'CreatorRate',                short: 'CR',   color: '#f43f5e' },
  nlca:        { name: 'Next Level Creator Agency',  short: 'NLCA', color: '#06b6d4' },
};

const COMPANY_HOME: Record<CompanySlug, string> = {
  nls:         '/admin/nls',
  meridian:    '/admin/meridian',
  quorex:      '/admin/quorex',
  reminder:    '/admin/reminder',
  group:       '/admin/group',
  creatorrate: '/admin/creatorrate',
  nlca:        '/admin/nlca',
};

const COMPANY_ORDER: CompanySlug[] = ['group', 'nls', 'meridian', 'quorex', 'reminder', 'creatorrate', 'nlca'];

/* ── Nav section header helper ──────────────────────── */
function sectionItem(section: string, href: string, label: string, icon: React.ReactNode, adminOnly?: boolean): NavItem {
  return { href, label, icon, section, adminOnly };
}

/* ── Nav arrays per company ─────────────────────────── */
const COMPANY_NAV: Record<CompanySlug, NavEntry[]> = {
  nls: [
    sectionItem('OVERSIGT',   '/admin/nls',              'Oversigt',        <GridIcon />),
    sectionItem('STYRING',    '/admin/sitreps',          'Sitreps',         <NoteIcon />),
    sectionItem('',           '/admin/followups',        'Follow-ups',      <FollowIcon />),
    sectionItem('',           '/admin/presence',         'Tilstedeværelse', <UserCheckIcon />),
    sectionItem('',           '/admin/targets',          'Targets',         <TargetIcon />),
    sectionItem('',           '/admin/daily',            'Daglige mål',     <BarIcon />),
    sectionItem('',           '/admin/nls/absence',      'Fravær',          <CalendarIcon />),
    sectionItem('',           '/admin/tasks',            'Opgaver',         <TaskIcon />),
    sectionItem('TEAM',       '/admin/sellers',          'Sælgere',         <TeamIcon />),
    sectionItem('',           '/admin/sales',            'Mine salg',       <SalesIcon />),
    sectionItem('',           '/admin/periods',          'Lønperioder',     <CalendarIcon />),
    sectionItem('',           '/admin/revenue',          'Revenue',         <BarIcon />),
    sectionItem('PLATFORM',   '/admin/nls/board',        'Board',           <BoardIcon />),
    sectionItem('',           '/admin/nls/messages',     'Beskeder',        <ChatIcon />),
  ],
  meridian: [
    sectionItem('OVERSIGT',   '/admin/meridian',          'Overblik',       <GridIcon />),
    sectionItem('KUNDER',     '/admin/customers',         'Kunder',         <PeopleIcon />),
    sectionItem('',           '/admin/handover',          'Handover',       <HandoverIcon />),
    sectionItem('',           '/admin/portal',            'Klientportal',   <PortalIcon />),
    sectionItem('PRODUKTER',  '/admin/meridian/products', 'Produktkatalog', <TaskIcon />),
    sectionItem('TEAM',       '/admin/meridian/team',     'AM / KAM',       <TeamIcon />),
    sectionItem('',           '/admin/meridian/absence',  'Fravær',         <CalendarIcon />),
    sectionItem('PLATFORM',   '/admin/meridian/board',    'Board',          <BoardIcon />),
    sectionItem('',           '/admin/meridian/messages', 'Beskeder',       <ChatIcon />),
  ],
  quorex: [
    sectionItem('OVERSIGT',  '/admin/quorex',           'Overblik', <GridIcon />),
    sectionItem('VÆKST',     '/admin/quorex/mrr',       'MRR',      <BarIcon />),
    sectionItem('',          '/admin/quorex/customers', 'Kunder',   <PeopleIcon />),
    sectionItem('',          '/admin/quorex/stripe',    'Stripe',   <PortalIcon />),
    sectionItem('PLATFORM',  '/admin/quorex/board',     'Board',    <BoardIcon />),
    sectionItem('',          '/admin/quorex/messages',  'Beskeder', <ChatIcon />),
  ],
  reminder: [
    sectionItem('OVERSIGT',  '/admin/reminder',           'Overblik', <GridIcon />),
    sectionItem('VÆKST',     '/admin/reminder/mrr',       'MRR',      <BarIcon />),
    sectionItem('',          '/admin/reminder/customers', 'Kunder',   <PeopleIcon />),
    sectionItem('',          '/admin/reminder/stripe',    'Stripe',   <PortalIcon />),
    sectionItem('PLATFORM',  '/admin/reminder/board',     'Board',    <BoardIcon />),
    sectionItem('',          '/admin/reminder/messages',  'Beskeder', <ChatIcon />),
  ],
  group: [
    sectionItem('KONCERN',  '/admin/group',            'Koncern Overblik', <GridIcon />),
    sectionItem('',         '/admin/group/board',      'Mit board',        <BoardIcon />),
    sectionItem('',         '/admin/group/tickets',    'Dev tickets',      <TaskIcon />),
    sectionItem('',         '/admin/messages',         'Beskeder',         <ChatIcon />),
    sectionItem('CRM',      '/admin/crm',                  'Pipeline',         <CrmIcon />),
    sectionItem('',         '/admin/crm/companies',        'Virksomheder',     <BuildingIcon />),
    sectionItem('',         '/admin/group/my-customers',  'Mine Kunder',      <EuroIcon />),
    sectionItem('TEAM',     '/admin/group/employees',     'Medarbejdere',     <TeamIcon />),
    sectionItem('',         '/admin/group/absence',    'Fravær (alle)',    <CalendarIcon />),
    sectionItem('FINANS',   '/admin/group/finance',    'Økonomi',          <BarIcon />),
    sectionItem('SYSTEM',   '/admin/companies',        'Virksomheder',     <BuildingIcon />),
    sectionItem('',         '/admin/settings',         'Indstillinger',    <GearIcon />),
  ],
  creatorrate: [
    sectionItem('OVERSIGT',  '/admin/creatorrate',           'Overblik',  <GridIcon />),
    sectionItem('CREATORS',  '/admin/creatorrate/creators',  'Creators',  <PeopleIcon />),
    sectionItem('SUPPORT',   '/admin/creatorrate/tickets',   'Tickets',   <TaskIcon />),
    sectionItem('PLATFORM',  '/admin/creatorrate/board',     'Board',     <BoardIcon />),
    sectionItem('',          '/admin/creatorrate/messages',  'Beskeder',  <ChatIcon />),
    sectionItem('',          '/admin/settings',              'Indstillinger', <GearIcon />),
  ],
  nlca: [
    sectionItem('OVERSIGT',  '/admin/nlca',                       'Overblik',        <GridIcon />),
    sectionItem('CREATORS',  '/admin/nlca/creators',              'Creators',        <PeopleIcon />),
    sectionItem('',          '/admin/nlca/payouts',               'Udbetalinger',    <EuroIcon />),
    sectionItem('TEAM',      '/admin/nlca/managers',              'Managers',        <TeamIcon />, true),
    sectionItem('',          '/admin/nlca/country-managers',      'Landsmanagere',   <GlobeIcon />, true),
    sectionItem('PLATFORM',  '/admin/nlca/board',                 'Board',           <BoardIcon />),
    sectionItem('',          '/admin/nlca/messages',              'Beskeder',        <ChatIcon />),
  ],
};

const COMPANY_BOTTOM_NAV: Record<CompanySlug, { href: string; label: string; icon: React.ReactNode }[]> = {
  nls: [
    { href: '/admin/nls',          label: 'Oversigt', icon: <GridIcon /> },
    { href: '/admin/nls/board',    label: 'Board',    icon: <BoardIcon /> },
    { href: '/admin/sitreps',      label: 'Sitreps',  icon: <NoteIcon /> },
    { href: '/admin/nls/messages', label: 'Beskeder', icon: <ChatIcon /> },
  ],
  meridian: [
    { href: '/admin/meridian',          label: 'Oversigt',   icon: <GridIcon /> },
    { href: '/admin/meridian/board',    label: 'Board',      icon: <BoardIcon /> },
    { href: '/admin/customers',         label: 'Kunder',     icon: <PeopleIcon /> },
    { href: '/admin/meridian/messages', label: 'Beskeder',   icon: <ChatIcon /> },
  ],
  quorex: [
    { href: '/admin/quorex',           label: 'Oversigt', icon: <GridIcon /> },
    { href: '/admin/quorex/board',     label: 'Board',    icon: <BoardIcon /> },
    { href: '/admin/quorex/messages',  label: 'Beskeder', icon: <ChatIcon /> },
    { href: '/admin/quorex/customers', label: 'Kunder',   icon: <PeopleIcon /> },
  ],
  reminder: [
    { href: '/admin/reminder',           label: 'Oversigt', icon: <GridIcon /> },
    { href: '/admin/reminder/board',     label: 'Board',    icon: <BoardIcon /> },
    { href: '/admin/reminder/messages',  label: 'Beskeder', icon: <ChatIcon /> },
    { href: '/admin/reminder/customers', label: 'Kunder',   icon: <PeopleIcon /> },
  ],
  group: [
    { href: '/admin/group',           label: 'Overblik',  icon: <GridIcon /> },
    { href: '/admin/crm',             label: 'CRM',       icon: <CrmIcon /> },
    { href: '/admin/companies',       label: 'Firmaer',   icon: <BuildingIcon /> },
    { href: '/admin/messages',        label: 'Beskeder',  icon: <ChatIcon /> },
  ],
  creatorrate: [
    { href: '/admin/creatorrate',          label: 'Overblik', icon: <GridIcon /> },
    { href: '/admin/creatorrate/board',    label: 'Board',    icon: <BoardIcon /> },
    { href: '/admin/creatorrate/messages', label: 'Beskeder', icon: <ChatIcon /> },
    { href: '/admin/settings',             label: 'Indst.',   icon: <GearIcon /> },
  ],
  nlca: [
    { href: '/admin/nlca',              label: 'Overblik',    icon: <GridIcon /> },
    { href: '/admin/nlca/creators',     label: 'Creators',    icon: <PeopleIcon /> },
    { href: '/admin/nlca/payouts',      label: 'Udbet.',      icon: <EuroIcon /> },
    { href: '/admin/nlca/messages',     label: 'Beskeder',    icon: <ChatIcon /> },
  ],
};

const sellerNav: NavEntry[] = [
  { href: '/dashboard',             label: 'Overblik',      icon: <GridIcon /> },
  { href: '/dashboard/daily',       label: 'Dagligt mål',   icon: <TargetIcon /> },
  { href: '/dashboard/sales',       label: 'Mine salg',     icon: <SalesIcon /> },
  { href: '/dashboard/sitrep',      label: 'Sitrep',        icon: <NoteIcon /> },
  { href: '/dashboard/absence',     label: 'Fravær',        icon: <CalendarIcon /> },
  { href: '/dashboard/leaderboard', label: 'Leaderboard',   icon: <TrophyIcon /> },
  { href: '/dashboard/board',       label: 'Mit board',     icon: <BoardIcon /> },
  { href: '/dashboard/messages',    label: 'Beskeder',      icon: <ChatIcon /> },
  { href: '/dashboard/settings',    label: 'Indstillinger', icon: <GearIcon /> },
];

const sellerBottomNav = [
  { href: '/dashboard',          label: 'Oversigt', icon: <GridIcon /> },
  { href: '/dashboard/board',    label: 'Board',    icon: <BoardIcon /> },
  { href: '/dashboard/log',      label: 'Log',      icon: <SalesIcon /> },
  { href: '/dashboard/messages', label: 'Beskeder', icon: <ChatIcon /> },
  { href: '/dashboard/settings', label: 'Profil',   icon: <GearIcon /> },
];

/* ── inferCompany: map any pathname to a company context ── */
function inferCompany(pathname: string): CompanySlug {
  if (pathname.startsWith('/admin/meridian'))    return 'meridian';
  if (pathname.startsWith('/admin/quorex'))      return 'quorex';
  if (pathname.startsWith('/admin/reminder'))    return 'reminder';
  if (pathname.startsWith('/admin/group'))       return 'group';
  if (pathname.startsWith('/admin/creatorrate')) return 'creatorrate';
  if (pathname.startsWith('/admin/nlca'))        return 'nlca';

  // CRM belongs to Group
  if (pathname.startsWith('/admin/crm'))         return 'group';

  // Shared pages that belong to specific company contexts
  if (pathname.startsWith('/admin/customers'))   return 'meridian';
  if (pathname.startsWith('/admin/handover'))    return 'meridian';
  if (pathname.startsWith('/admin/portal'))      return 'meridian';

  // Group-level shared pages
  if (pathname.startsWith('/admin/companies'))   return 'group';
  if (pathname.startsWith('/admin/messages'))    return 'group';
  if (pathname.startsWith('/admin/settings'))    return 'group';

  return 'nls';
}

function isActive(href: string, pathname: string): boolean {
  if (href === '/admin' || href === '/dashboard') return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

const PAGE_LABELS: Record<string, string> = {
  nls: 'Oversigt', meridian: 'Overblik', quorex: 'Overblik', reminder: 'Overblik',
  creatorrate: 'Overblik', group: 'Koncern Overblik', nlca: 'Overblik',
  board: 'Board', messages: 'Beskeder', sitreps: 'Sitreps',
  followups: 'Follow-ups', presence: 'Tilstedeværelse', targets: 'Targets',
  daily: 'Daglige mål', sales: 'Salgslog', sellers: 'Sælgere', tasks: 'Opgaver',
  periods: 'Lønperioder', settings: 'Indstillinger', companies: 'Virksomheder',
  customers: 'Kunder', handover: 'Handovers', portal: 'Klientportal',
  crm: 'CRM Pipeline', contacts: 'Virksomheder', activity: 'Aktivitetsfeed',
  'my-customers': 'Mine Kunder',
  finance: 'Økonomi', products: 'Produktkatalog', team: 'Team', payroll: 'Løn',
  mrr: 'MRR', stripe: 'Stripe', revenue: 'Omsætning', absence: 'Fravær',
  employees: 'Medarbejdere',
  creators: 'Creators', payouts: 'Udbetalinger', managers: 'Managers',
};

function getPageLabel(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  return PAGE_LABELS[last] ?? last;
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ['#4f8ef7', '#2dd4a0', '#a78bfa', '#f59e0b', '#ff6b35'];
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

/* ── Props ───────────────────────────────────────────── */
interface Props {
  role: 'ADMIN' | 'MANAGER' | 'SELLER' | 'NLCA_MANAGER';
  name: string;
  children: React.ReactNode;
}

/* ── Default export wraps with provider ─────────────── */
export default function AppShell({ role, name, children }: Props) {
  return (
    <CompanyProvider>
      <AppShellInner role={role} name={name}>{children}</AppShellInner>
    </CompanyProvider>
  );
}

/* ── Inner shell (consumes context) ─────────────────── */
function AppShellInner({ role, name, children }: Props) {
  const pathname = usePathname();
  const router   = useRouter();
  const { setActiveCompany } = useCompany();

  const displayCompany: CompanySlug =
    role === 'SELLER' ? 'nls' :
    role === 'NLCA_MANAGER' ? 'nlca' :
    inferCompany(pathname);
  const meta = COMPANY_META[displayCompany];

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [unreadCount, setUnreadCount]  = useState(0);

  useEffect(() => {
    if (role !== 'SELLER') setActiveCompany(displayCompany);
  }, [displayCompany, role, setActiveCompany]);

  const visibleCompanies = role === 'NLCA_MANAGER' ? (['nlca'] as CompanySlug[]) : COMPANY_ORDER;

  useEffect(() => {
    let mounted = true;
    function poll() {
      fetch('/api/messages/unread/count')
        .then(r => r.json())
        .then((d: { count: number }) => { if (mounted) setUnreadCount(d.count || 0); })
        .catch(() => {});
    }
    poll();
    const id = setInterval(poll, 30_000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const nav       = role === 'SELLER' ? sellerNav : COMPANY_NAV[displayCompany];
  const bottomNav = role === 'SELLER' ? sellerBottomNav : COMPANY_BOTTOM_NAV[displayCompany];
  const color     = avatarColor(name);

  function switchCompany(slug: CompanySlug) {
    setActiveCompany(slug);
    router.push(COMPANY_HOME[slug]);
    setSwitcherOpen(false);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  /* Render nav items with section headers */
  function renderNav(entries: NavEntry[]) {
    const result: React.ReactNode[] = [];
    let lastSection = '__init__';

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (isGroup(entry)) {
        if (entry.adminOnly && role !== 'ADMIN') continue;
        result.push(
          <details key={`group-${i}`} style={{ marginBottom: 2 }}>
            <summary style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', borderRadius: 7, cursor: 'pointer',
              color: 'var(--t3)', fontSize: 13, fontWeight: 500, listStyle: 'none',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ opacity: 0.7 }}>{entry.icon}</span>
                {entry.label}
              </span>
              <svg width="9" height="6" viewBox="0 0 9 6" fill="none" style={{ opacity: 0.4 }}>
                <path d="M1 1l3.5 4L8 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </summary>
            <div style={{ marginLeft: 12, borderLeft: '1px solid var(--bd)', paddingLeft: 8, marginBottom: 4 }}>
              {entry.children.map(child => (
                <NavLink key={child.href} href={child.href} label={child.label} icon={child.icon}
                  active={isActive(child.href, pathname)} badge={child.label === 'Beskeder' && unreadCount > 0} />
              ))}
            </div>
          </details>
        );
        continue;
      }

      const section = entry.section ?? '';
      if (section !== '' && section !== lastSection) {
        result.push(
          <div key={`section-${section}`} style={{
            padding: '12px 10px 4px', fontSize: 9, fontWeight: 700,
            color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase',
          }}>
            {section}
          </div>
        );
        lastSection = section;
      }

      if (entry.adminOnly && role !== 'ADMIN') continue;

      result.push(
        <NavLink key={entry.href} href={entry.href} label={entry.label} icon={entry.icon}
          active={isActive(entry.href, pathname)} badge={entry.label === 'Beskeder' && unreadCount > 0} />
      );
    }
    return result;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="sidebar-desktop" style={{
        width: 224, flexShrink: 0,
        background: 'var(--s1)', borderRight: '1px solid var(--bd)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid var(--bd)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--bl2)', border: '1px solid rgba(79,142,247,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5" height="5" rx="1.5" fill="var(--bl)" />
                <rect x="8" y="1" width="5" height="5" rx="1.5" fill="var(--bl)" opacity=".6" />
                <rect x="1" y="8" width="5" height="5" rx="1.5" fill="var(--bl)" opacity=".6" />
                <rect x="8" y="8" width="5" height="5" rx="1.5" fill="var(--bl)" opacity=".3" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.01em', lineHeight: 1 }}>NextLevel</div>
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2, letterSpacing: '0.06em', fontWeight: 600 }}>GROUP</div>
            </div>
          </div>
        </div>

        {/* Company switcher (admin/manager only) */}
        {role !== 'SELLER' && (
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--bd)', position: 'relative' }}>
            {role === 'NLCA_MANAGER' ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '7px 10px', borderRadius: 7, border: '1px solid var(--bd)',
                background: 'var(--s2)',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ flex: 1, textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>{meta.short}</span>
                <span style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 400 }}>{meta.name}</span>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setSwitcherOpen(o => !o)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '7px 10px', borderRadius: 7, border: '1px solid var(--bd)',
                    background: 'var(--s2)', cursor: 'pointer',
                    transition: 'border-color 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--bd2)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--bd)')}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ flex: 1, textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>{meta.short}</span>
                  <span style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 400, marginRight: 2 }}>{meta.name}</span>
                  <svg width="9" height="6" viewBox="0 0 9 6" fill="none" style={{ opacity: 0.4, flexShrink: 0, transform: switcherOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    <path d="M1 1l3.5 4L8 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {switcherOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 10, right: 10, zIndex: 100,
                    background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 9,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)', overflow: 'hidden', marginTop: 2,
                  }}>
                    {visibleCompanies.map(slug => {
                      const m = COMPANY_META[slug];
                      const isActive = slug === displayCompany;
                      return (
                        <button key={slug} onClick={() => switchCompany(slug)} style={{
                          display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                          padding: '9px 12px', border: 'none', cursor: 'pointer', textAlign: 'left',
                          background: isActive ? 'var(--bl2)' : 'transparent',
                          borderBottom: '1px solid var(--bd)',
                          transition: 'background 0.1s',
                        }}
                          onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--s2)'; }}
                          onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        >
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--bl)' : 'var(--t1)' }}>{m.short}</span>
                          <span style={{ fontSize: 11, color: 'var(--t3)', marginLeft: 2 }}>{m.name}</span>
                          {isActive && <svg style={{ marginLeft: 'auto' }} width="11" height="8" viewBox="0 0 11 8" fill="none"><path d="M1 4l3 3 6-6" stroke="var(--bl)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 10px', overflowY: 'auto' }}>
          {renderNav(nav)}
        </nav>

        {/* User row */}
        <div style={{ padding: '14px 14px 18px', borderTop: '1px solid var(--bd)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: `${color}22`, border: `1.5px solid ${color}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color,
            }}>
              {initials(name)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>{role}</div>
            </div>
          </div>
          <button onClick={logout} style={{
            width: '100%', padding: '7px 0', borderRadius: 7,
            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--bd)',
            color: 'var(--t3)', fontSize: 12, fontWeight: 500, transition: 'background 0.15s, color 0.15s',
          }}
            onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = 'var(--re)'; (e.target as HTMLButtonElement).style.background = 'var(--re2)'; }}
            onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = 'var(--t3)'; (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
          >
            Log ud
          </button>
        </div>
      </aside>

      {/* ── Content column ──────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Topbar (admin/manager only) */}
        {role !== 'SELLER' && (
          <div style={{
            height: 46, flexShrink: 0,
            background: 'var(--s1)', borderBottom: '1px solid var(--bd)',
            display: 'flex', alignItems: 'center', padding: '0 24px', gap: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, display: 'inline-block' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>{meta.name}</span>
              <span style={{ fontSize: 12, color: 'var(--bd2)', margin: '0 4px' }}>/</span>
              <span style={{ fontSize: 12, color: 'var(--t3)' }}>{getPageLabel(pathname)}</span>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="main-content" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
          {switcherOpen && (
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 99 }}
              onClick={() => setSwitcherOpen(false)}
            />
          )}
          {children}
        </main>
      </div>

      {/* ── Bottom nav (mobile) ─────────────────────────── */}
      <nav className="bottom-nav">
        {bottomNav.map(item => {
          const active = isActive(item.href, pathname);
          const hasBadge = item.label === 'Beskeder' && unreadCount > 0;
          return (
            <a key={item.href} href={item.href} className={`bottom-nav-item${active ? ' active' : ''}`} style={{ position: 'relative' }}>
              {hasBadge && (
                <span style={{ position: 'absolute', top: 6, right: '50%', transform: 'translateX(8px)', width: 7, height: 7, borderRadius: '50%', background: 'var(--bl)', border: '1.5px solid var(--bg)' }} />
              )}
              {item.icon}
              <span>{item.label}</span>
            </a>
          );
        })}
        <button onClick={logout} className="bottom-nav-item" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <GearIcon />
          <span>Log ud</span>
        </button>
      </nav>
    </div>
  );
}

/* ── NavLink ────────────────────────────────────────── */
function NavLink({ href, label, icon, active, badge }: { href: string; label: string; icon: React.ReactNode; active: boolean; badge?: boolean }) {
  return (
    <a href={href} style={{
      display: 'flex', alignItems: 'center', gap: 9,
      padding: '7px 10px', borderRadius: 7, marginBottom: 1,
      textDecoration: 'none',
      background: active ? 'var(--bl2)' : 'transparent',
      color: active ? 'var(--bl)' : 'var(--t3)',
      fontWeight: active ? 600 : 500, fontSize: 13,
      transition: 'all 0.1s',
    }}>
      <span style={{ opacity: active ? 1 : 0.65 }}>{icon}</span>
      {label}
      {badge && (
        <span style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: 'var(--bl)', flexShrink: 0, display: 'inline-block' }} />
      )}
    </a>
  );
}

/* ── SVG Icons (15×15) ─────────────────────────────── */
function GridIcon()      { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="1" width="5.5" height="5.5" rx="1.5" fill="currentColor"/><rect x="8.5" y="1" width="5.5" height="5.5" rx="1.5" fill="currentColor" opacity=".6"/><rect x="1" y="8.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" opacity=".6"/><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.5" fill="currentColor" opacity=".3"/></svg> }
function TargetIcon()    { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.4"/><circle cx="7.5" cy="7.5" r="3" stroke="currentColor" strokeWidth="1.4"/><circle cx="7.5" cy="7.5" r=".8" fill="currentColor"/></svg> }
function SalesIcon()     { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 11l3-4 3 2 3-5 2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg> }
function NoteIcon()      { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="2.5" y="2" width="10" height="11" rx="2" stroke="currentColor" strokeWidth="1.4"/><line x1="5" y1="5.5" x2="10" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="5" y1="8" x2="9" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> }
function CalendarIcon()  { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="2" y="3" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><line x1="5" y1="2" x2="5" y2="4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="10" y1="2" x2="10" y2="4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="2" y1="6.5" x2="13" y2="6.5" stroke="currentColor" strokeWidth="1.2"/></svg> }
function TrophyIcon()    { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M5 2h5v5a2.5 2.5 0 01-5 0V2z" stroke="currentColor" strokeWidth="1.4"/><path d="M3 3H1.5a1 1 0 00-1 1v.5A2.5 2.5 0 003 7M12 3h1.5a1 1 0 011 1v.5A2.5 2.5 0 0112 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><line x1="7.5" y1="9.5" x2="7.5" y2="12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="5" y1="12" x2="10" y2="12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> }
function BoardIcon()     { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1.5" y="2" width="4" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="7.5" y="2" width="4" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/></svg> }
function ChatIcon()      { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 2.5h11a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 2V3.5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg> }
function GearIcon()      { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 9.5a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="1.4"/><path d="M12.5 7.5l.8-.46a1 1 0 00.14-1.59l-.7-.7a1 1 0 00-1.59.14L10.66 6h-.32l-.54-.93a1 1 0 00-1.6-.14l-.7.7a1 1 0 00.14 1.6L8.1 7.76v.48l-.47.27a1 1 0 00-.14 1.6l.7.7a1 1 0 001.6-.14l.53-.93h.32l.47.82a1 1 0 001.59.14l.7-.7a1 1 0 00-.14-1.59L12.5 8v-.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/></svg> }
function FollowIcon()    { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 12.5l2.5-2.5m0 0l3-3 2 2 3-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><circle cx="11.5" cy="4" r="1" fill="currentColor"/></svg> }
function UserCheckIcon() { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M1.5 13c0-2.5 2-4 4.5-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M9.5 11l1.5 1.5 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg> }
function BarIcon()       { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="2" y="7" width="3" height="6" rx="1" fill="currentColor" opacity=".5"/><rect x="6" y="4" width="3" height="9" rx="1" fill="currentColor" opacity=".7"/><rect x="10" y="2" width="3" height="11" rx="1" fill="currentColor"/></svg> }
function BuildingIcon()  { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="2.5" y="2" width="10" height="11" rx="1" stroke="currentColor" strokeWidth="1.4"/><line x1="6" y1="2" x2="6" y2="13" stroke="currentColor" strokeWidth="1.2"/><rect x="4" y="5" width="1.5" height="2" rx=".5" fill="currentColor"/><rect x="8.5" y="5" width="1.5" height="2" rx=".5" fill="currentColor"/><rect x="8.5" y="9" width="1.5" height="2" rx=".5" fill="currentColor"/></svg> }
function PeopleIcon()    { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="5.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M1 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M12 7c1.2.6 2 1.8 2 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M9.5 2.5A2.5 2.5 0 1112 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> }
function HandoverIcon()  { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 9.5h5l2-1.5 4 .5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 12l3-2.5M4.5 7V4a1 1 0 011-1h4a1 1 0 011 1v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> }
function PortalIcon()    { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="2" y="2" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.4"/><circle cx="7.5" cy="7.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/><line x1="7.5" y1="2" x2="7.5" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="7.5" y1="10" x2="7.5" y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="2" y1="7.5" x2="5" y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="10" y1="7.5" x2="13" y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> }
function TeamIcon()      { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M2 13c0-2.5 2.5-4.5 5.5-4.5S13 10.5 13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> }
function TaskIcon()      { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="2.5" y="2" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M5 7l2 2 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg> }
function CrmIcon()       { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M1 13c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M10 3l1.5 1.5L14 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><line x1="10" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><line x1="10" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> }
function EuroIcon()      { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.4"/><path d="M9.5 5.5A2.5 2.5 0 007 8a2.5 2.5 0 002.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><line x1="5" y1="7" x2="8.5" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="5" y1="9" x2="8.5" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> }
function GlobeIcon()     { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.4"/><ellipse cx="7.5" cy="7.5" rx="2.5" ry="6" stroke="currentColor" strokeWidth="1.2"/><line x1="1.5" y1="7.5" x2="13.5" y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="2.5" y1="5" x2="12.5" y2="5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/><line x1="2.5" y1="10" x2="12.5" y2="10" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg> }
