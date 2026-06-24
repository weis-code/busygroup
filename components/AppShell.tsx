'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface NavItem  { href: string; label: string; icon: React.ReactNode }
interface NavGroup { group: true; label: string; icon: React.ReactNode; adminOnly?: boolean; children: NavItem[] }
type NavEntry = NavItem | NavGroup

const sellerNav: NavEntry[] = [
  { href: '/dashboard',            label: 'Overblik',      icon: <GridIcon /> },
  { href: '/dashboard/daily',      label: 'Dagligt mål',   icon: <TargetIcon /> },
  { href: '/dashboard/sales',      label: 'Mine salg',     icon: <SalesIcon /> },
  { href: '/dashboard/sitrep',     label: 'Sitrep',        icon: <NoteIcon /> },
  { href: '/dashboard/absence',    label: 'Fravær',        icon: <CalendarIcon /> },
  { href: '/dashboard/leaderboard',label: 'Leaderboard',   icon: <TrophyIcon /> },
  { href: '/dashboard/board',      label: 'Mit board',     icon: <BoardIcon /> },
  { href: '/dashboard/messages',   label: 'Beskeder',      icon: <ChatIcon /> },
  { href: '/dashboard/settings',   label: 'Indstillinger', icon: <GearIcon /> },
];

const adminNav: NavEntry[] = [
  { href: '/admin',             label: 'Oversigt',         icon: <GridIcon /> },
  { href: '/dashboard/sales',   label: 'Mine salg',        icon: <SalesIcon /> },
  { href: '/admin/sitreps',     label: 'Sitreps',          icon: <NoteIcon /> },
  { href: '/admin/followups',   label: 'Follow-ups',       icon: <FollowIcon /> },
  { href: '/admin/presence',    label: 'Tilstedeværelse',  icon: <UserCheckIcon /> },
  { href: '/admin/targets',     label: 'Targets',          icon: <TargetIcon /> },
  { href: '/admin/daily',       label: 'Daglige mål',      icon: <BarIcon /> },
  {
    group: true, label: 'Indstillinger', icon: <GearIcon />, adminOnly: true,
    children: [
      { href: '/admin/sales',    label: 'Salgslog',        icon: <SalesIcon /> },
      { href: '/admin/sellers',  label: 'Sælgere',         icon: <TeamIcon /> },
      { href: '/admin/tasks',    label: 'Opgaver',         icon: <TaskIcon /> },
      { href: '/admin/periods',  label: 'Lønperioder',     icon: <CalendarIcon /> },
      { href: '/admin/settings', label: 'Indstillinger',   icon: <GearIcon /> },
    ],
  },
  { href: '/admin/group',     label: 'Group overblik',  icon: <GroupIcon />,   _section: 'PLATFORM' } as NavItem & { _section: string },
  { href: '/admin/companies', label: 'Virksomheder',    icon: <BuildingIcon /> },
  { href: '/admin/customers', label: 'Kunder',          icon: <PeopleIcon /> },
  { href: '/admin/handover',  label: 'Handovers',       icon: <HandoverIcon /> },
  { href: '/admin/portal',    label: 'Klientportal',    icon: <PortalIcon /> },
  { href: '/admin/messages',  label: 'Beskeder',        icon: <ChatIcon /> },
];

const sellerBottomNav = [
  { href: '/dashboard',             label: 'Oversigt', icon: <GridIcon /> },
  { href: '/dashboard/board',       label: 'Board',    icon: <BoardIcon /> },
  { href: '/dashboard/log',         label: 'Log',      icon: <SalesIcon /> },
  { href: '/dashboard/messages',    label: 'Beskeder', icon: <ChatIcon /> },
  { href: '/dashboard/settings',    label: 'Profil',   icon: <GearIcon /> },
];

const adminBottomNav = [
  { href: '/admin/group',     label: 'Group',    icon: <GroupIcon /> },
  { href: '/admin',           label: 'NLS',      icon: <GridIcon /> },
  { href: '/admin/messages',  label: 'Beskeder', icon: <ChatIcon /> },
  { href: '/admin/customers', label: 'Kunder',   icon: <PeopleIcon /> },
];

interface Props {
  role: 'ADMIN' | 'MANAGER' | 'SELLER';
  name: string;
  children: React.ReactNode;
}

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'group' in entry && entry.group === true;
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ['#4f8ef7', '#2dd4a0', '#a78bfa', '#f59e0b', '#ff6b35'];
function avatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export default function AppShell({ role, name, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = role === 'SELLER' ? sellerNav : adminNav;
  const bottomNav = role === 'SELLER' ? sellerBottomNav : adminBottomNav;

  const settingsGroup = adminNav.find(isGroup) as NavGroup | undefined;
  const settingsActive = settingsGroup?.children.some(c => pathname.startsWith(c.href)) ?? false;
  const [settingsOpen, setSettingsOpen] = useState(settingsActive);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const color = avatarColor(name);

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>
      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="sidebar-desktop" style={{
        width: 224, flexShrink: 0,
        background: 'var(--s1)',
        borderRight: '1px solid var(--bd)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 18px 18px', borderBottom: '1px solid var(--bd)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--bl2)',
              border: '1px solid rgba(79,142,247,0.3)',
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

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
          {nav.map((entry, i) => {
            if (isGroup(entry)) {
              if (entry.adminOnly && role !== 'ADMIN') return null;
              const groupActive = entry.children.some(c => pathname.startsWith(c.href));
              return (
                <div key={i}>
                  <button
                    onClick={() => setSettingsOpen(o => !o)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', padding: '8px 10px', borderRadius: 7, marginBottom: 2,
                      border: 'none', cursor: 'pointer', background: 'transparent',
                      color: groupActive && !settingsOpen ? 'var(--bl)' : 'var(--t3)',
                      fontSize: 13, fontWeight: 500,
                      transition: 'color 0.12s',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ opacity: 0.7 }}>{entry.icon}</span>
                      {entry.label}
                    </span>
                    <svg width="9" height="6" viewBox="0 0 9 6" fill="none" style={{ opacity: 0.4, transform: settingsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                      <path d="M1 1l3.5 4L8 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {settingsOpen && (
                    <div style={{ marginLeft: 12, borderLeft: '1px solid var(--bd)', paddingLeft: 8, marginBottom: 4 }}>
                      {entry.children.map(child => {
                        const active = pathname.startsWith(child.href);
                        return <NavLink key={child.href} href={child.href} label={child.label} icon={child.icon} active={active} />;
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const extEntry = entry as NavItem & { _section?: string };
            const showSection = !!extEntry._section && (i === 0 || !(nav[i - 1] as NavItem & { _section?: string })._section);

            const active = entry.href === '/admin' || entry.href === '/dashboard'
              ? pathname === entry.href
              : pathname.startsWith(entry.href);

            return (
              <div key={entry.href}>
                {showSection && (
                  <div style={{ padding: '10px 10px 6px', marginTop: 4 }}>
                    <div style={{ fontSize: 9, color: 'var(--t4)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      {extEntry._section}
                    </div>
                    <div style={{ height: 1, background: 'var(--bd)', marginTop: 6 }} />
                  </div>
                )}
                <NavLink href={entry.href} label={entry.label} icon={entry.icon} active={active} />
              </div>
            );
          })}
        </nav>

        {/* User row */}
        <div style={{ padding: '14px 14px 18px', borderTop: '1px solid var(--bd)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: `${color}22`,
              border: `1.5px solid ${color}55`,
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
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--bd)',
            color: 'var(--t3)', fontSize: 12, fontWeight: 500,
            transition: 'background 0.15s, color 0.15s',
          }}
            onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = 'var(--re)'; (e.target as HTMLButtonElement).style.background = 'var(--re2)'; }}
            onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = 'var(--t3)'; (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
          >
            Log ud
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────── */}
      <main className="main-content" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
        {children}
      </main>

      {/* ── Bottom nav (mobile) ─────────────────────────── */}
      <nav className="bottom-nav">
        {bottomNav.map(item => {
          const active = item.href === '/admin' || item.href === '/dashboard'
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <a key={item.href} href={item.href} className={`bottom-nav-item${active ? ' active' : ''}`}>
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
function NavLink({ href, label, icon, active }: { href: string; label: string; icon: React.ReactNode; active: boolean }) {
  return (
    <a href={href} style={{
      display: 'flex', alignItems: 'center', gap: 9,
      padding: '8px 10px', borderRadius: 7, marginBottom: 1,
      textDecoration: 'none',
      background: active ? 'var(--bl2)' : 'transparent',
      color: active ? 'var(--bl)' : 'var(--t3)',
      fontWeight: active ? 600 : 500,
      fontSize: 13,
      transition: 'all 0.1s',
    }}>
      <span style={{ opacity: active ? 1 : 0.65 }}>{icon}</span>
      {label}
    </a>
  );
}

/* ── SVG Icons (16×16) ─────────────────────────────── */
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
function GroupIcon()     { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="5" cy="6" r="2" stroke="currentColor" strokeWidth="1.3"/><circle cx="10.5" cy="6" r="2" stroke="currentColor" strokeWidth="1.3"/><path d="M1.5 13c0-1.7 1.6-3 3.5-3M13.5 13c0-1.7-1.6-3-3.5-3M6.5 13c0-1.7 1.3-3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> }
function BuildingIcon()  { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="2.5" y="2" width="10" height="11" rx="1" stroke="currentColor" strokeWidth="1.4"/><line x1="6" y1="2" x2="6" y2="13" stroke="currentColor" strokeWidth="1.2"/><rect x="4" y="5" width="1.5" height="2" rx=".5" fill="currentColor"/><rect x="8.5" y="5" width="1.5" height="2" rx=".5" fill="currentColor"/><rect x="8.5" y="9" width="1.5" height="2" rx=".5" fill="currentColor"/></svg> }
function PeopleIcon()    { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="5.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M1 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M12 7c1.2.6 2 1.8 2 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M9.5 2.5A2.5 2.5 0 1112 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> }
function HandoverIcon()  { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 9.5h5l2-1.5 4 .5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 12l3-2.5M4.5 7V4a1 1 0 011-1h4a1 1 0 011 1v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> }
function PortalIcon()    { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="2" y="2" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.4"/><circle cx="7.5" cy="7.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/><line x1="7.5" y1="2" x2="7.5" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="7.5" y1="10" x2="7.5" y2="13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="2" y1="7.5" x2="5" y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="10" y1="7.5" x2="13" y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> }
function TeamIcon()      { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M2 13c0-2.5 2.5-4.5 5.5-4.5S13 10.5 13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> }
function TaskIcon()      { return <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="2.5" y="2" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M5 7l2 2 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg> }
