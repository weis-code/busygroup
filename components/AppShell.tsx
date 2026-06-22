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
  { href: '/dashboard/leaderboard', label: 'Leaderboard', icon: '◆' },
  { href: '/dashboard/settings', label: 'Indstillinger', icon: '◌' },
];

const adminNav: NavEntry[] = [
  { href: '/admin', label: 'Oversigt', icon: '◈' },
  { href: '/dashboard/sales', label: 'Mine salg', icon: '◎' },
  { href: '/admin/sitreps', label: 'Sitreps', icon: '◑' },
  { href: '/admin/followups', label: 'Follow-ups', icon: '◒' },
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
];

interface Props {
  role: 'ADMIN' | 'MANAGER' | 'SELLER';
  name: string;
  children: React.ReactNode;
}

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'group' in entry && entry.group === true;
}

export default function AppShell({ role, name, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = role === 'SELLER' ? sellerNav : adminNav;

  // Determine if settings group is active on initial render
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

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0F1923' }}>
      {/* Sidebar */}
      <aside style={{
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

            const active = entry.href === '/admin' || entry.href === '/dashboard'
              ? pathname === entry.href
              : pathname.startsWith(entry.href);
            return (
              <a key={entry.href} href={entry.href} style={itemStyle(active)}>
                <span style={{ fontSize: 10 }}>{entry.icon}</span>
                {entry.label}
              </a>
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
      <main style={{ flex: 1, overflowY: 'auto', background: '#0F1923' }}>
        {children}
      </main>
    </div>
  );
}
