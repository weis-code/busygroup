'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface NavItem { href: string; label: string; icon: string }
interface NavGroup { group: true; label: string; icon: string; adminOnly?: boolean; children: NavItem[] }
type NavEntry = NavItem | NavGroup

const sellerNav: NavEntry[] = [
  { href: '/dashboard', label: 'Overblik', icon: '◈' },
  { href: '/dashboard/daily', label: 'Dagligt mål', icon: '◐' },
  { href: '/dashboard/sales', label: 'Mine salg', icon: '◎' },
  { href: '/dashboard/sitrep', label: 'Sitrep', icon: '◑' },
  { href: '/dashboard/absence', label: 'Fravær', icon: '◫' },
  { href: '/dashboard/leaderboard', label: 'Leaderboard', icon: '◆' },
  { href: '/dashboard/board', label: 'Mit board', icon: '▦' },
  { href: '/dashboard/messages', label: 'Beskeder', icon: '◉' },
  { href: '/dashboard/settings', label: 'Indstillinger', icon: '◌' },
];

const adminNav: NavEntry[] = [
  { href: '/admin', label: 'Oversigt', icon: '◈' },
  { href: '/dashboard/sales', label: 'Mine salg', icon: '◎' },
  { href: '/admin/sitreps', label: 'Sitreps', icon: '◑' },
  { href: '/admin/followups', label: 'Follow-ups', icon: '◒' },
  { href: '/admin/presence', label: 'Tilstedeværelse', icon: '◫' },
  { href: '/admin/targets', label: 'Targets', icon: '◆' },
  { href: '/admin/daily', label: 'Daglige mål', icon: '◐' },
  {
    group: true, label: 'Indstillinger', icon: '◌', adminOnly: true,
    children: [
      { href: '/admin/sales', label: 'Salgslog', icon: '◎' },
      { href: '/admin/sellers', label: 'Sælgere', icon: '◉' },
      { href: '/admin/tasks', label: 'Opgaver', icon: '◇' },
      { href: '/admin/periods', label: 'Lønperioder', icon: '◇' },
      { href: '/admin/settings', label: 'Indstillinger', icon: '◌' },
    ],
  },
  // ── Platform ─────────────────────────────────────────────────
  { href: '/admin/group', label: 'Group overblik', icon: '◈' },
  { href: '/admin/companies', label: 'Virksomheder', icon: '▣' },
  { href: '/admin/customers', label: 'Kunder', icon: '◎' },
  { href: '/admin/handover', label: 'Handovers', icon: '◒' },
  { href: '/admin/portal', label: 'Klientportal', icon: '◇' },
  { href: '/admin/messages', label: 'Beskeder', icon: '◉' },
];

const sellerBottomNav = [
  { href: '/dashboard', label: 'Oversigt', icon: '◈' },
  { href: '/dashboard/board', label: 'Board', icon: '▦' },
  { href: '/dashboard/log', label: 'Log', icon: '◎' },
  { href: '/dashboard/messages', label: 'Beskeder', icon: '◉' },
  { href: '/dashboard/settings', label: 'Profil', icon: '◌' },
];

const adminBottomNav = [
  { href: '/admin/group', label: 'Group', icon: '◈' },
  { href: '/admin', label: 'NLS', icon: '▣' },
  { href: '/admin/messages', label: 'Beskeder', icon: '◉' },
  { href: '/admin/customers', label: 'Kunder', icon: '◎' },
];

interface Props {
  role: 'ADMIN' | 'MANAGER' | 'SELLER';
  name: string;
  children: React.ReactNode;
}

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'group' in entry && entry.group === true;
}

const PLATFORM_HREFS = ['/admin/group', '/admin/companies', '/admin/customers', '/admin/handover', '/admin/portal', '/admin/messages'];

export default function AppShell({ role, name, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = role === 'SELLER' ? sellerNav : adminNav;
  const bottomNav = role === 'SELLER' ? sellerBottomNav : adminBottomNav;

  const settingsGroup = adminNav.find(isGroup);
  const settingsActive = settingsGroup?.children.some(c => pathname.startsWith(c.href)) ?? false;
  const [settingsOpen, setSettingsOpen] = useState(settingsActive);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const itemStyle = (active: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 12px', borderRadius: 7, marginBottom: 2,
    textDecoration: 'none',
    background: active ? 'rgba(24,95,165,0.2)' : 'transparent',
    color: active ? '#185FA5' : '#667788',
    fontWeight: active ? 600 : 400,
    fontSize: 13,
    transition: 'all 0.12s',
  } as React.CSSProperties);

  const isPlatformSection = (href: string) => PLATFORM_HREFS.includes(href);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0F1923' }}>
      {/* Sidebar — hidden on mobile via CSS class */}
      <aside className="sidebar-desktop" style={{
        width: 220, flexShrink: 0, background: '#111E2A',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#185FA5', letterSpacing: '0.05em' }}>NEXT LEVEL</div>
          <div style={{ fontSize: 11, color: '#667788', marginTop: 2, letterSpacing: '0.08em' }}>SALES</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {nav.map((entry, i) => {
            if (isGroup(entry)) {
              if (entry.adminOnly && role !== 'ADMIN') return null;
              const groupActive = entry.children.some(c => pathname.startsWith(c.href));
              return (
                <div key={i}>
                  <button
                    onClick={() => setSettingsOpen(o => !o)}
                    style={{
                      ...itemStyle(groupActive && !settingsOpen),
                      width: '100%', border: 'none', cursor: 'pointer',
                      justifyContent: 'space-between',
                      background: groupActive && !settingsOpen ? 'rgba(24,95,165,0.2)' : 'transparent',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 10 }}>{entry.icon}</span>
                      {entry.label}
                    </span>
                    <span style={{ fontSize: 9, opacity: 0.5 }}>{settingsOpen ? '▲' : '▼'}</span>
                  </button>
                  {settingsOpen && (
                    <div style={{ marginLeft: 10, borderLeft: '1px solid rgba(255,255,255,0.07)', paddingLeft: 8, marginBottom: 2 }}>
                      {entry.children.map(child => {
                        const active = pathname.startsWith(child.href);
                        return (
                          <a key={child.href} href={child.href} style={itemStyle(active)}>
                            <span style={{ fontSize: 10 }}>{child.icon}</span>
                            {child.label}
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Separator before platform section
            const showSeparator = role !== 'SELLER' && isPlatformSection(entry.href) &&
              (i === 0 || !isPlatformSection((nav[i - 1] as NavItem).href));

            const active = entry.href === '/admin' || entry.href === '/dashboard'
              ? pathname === entry.href
              : pathname.startsWith(entry.href);
            return (
              <div key={entry.href}>
                {showSeparator && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '8px 0', paddingTop: 8 }}>
                    <div style={{ fontSize: 9, color: '#4a5d78', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', padding: '0 12px 6px' }}>PLATFORM</div>
                  </div>
                )}
                <a href={entry.href} style={itemStyle(active)}>
                  <span style={{ fontSize: 10 }}>{entry.icon}</span>
                  {entry.label}
                </a>
              </div>
            );
          })}
        </nav>

        {/* User */}
        <div style={{ padding: '16px 16px 20px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#ECF0F1', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
          <div style={{ fontSize: 11, color: '#667788', marginBottom: 10 }}>{role}</div>
          <button onClick={logout} style={{
            width: '100%', padding: '7px 0', borderRadius: 6,
            background: 'rgba(255,255,255,0.05)', color: '#667788',
            fontSize: 12,
          }}>
            Log ud
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content" style={{ flex: 1, overflowY: 'auto', background: '#0F1923' }}>
        {children}
      </main>

      {/* Bottom nav — shown on mobile via CSS */}
      <nav className="bottom-nav">
        {bottomNav.map(item => {
          const active = item.href === '/admin' || item.href === '/dashboard'
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <a key={item.href} href={item.href} className={`bottom-nav-item${active ? ' active' : ''}`}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span>{item.label}</span>
            </a>
          );
        })}
        <button
          onClick={logout}
          className="bottom-nav-item"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 20 }}>◌</span>
          <span>Log ud</span>
        </button>
      </nav>
    </div>
  );
}
