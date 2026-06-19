'use client';

import { usePathname, useRouter } from 'next/navigation';

interface NavItem { href: string; label: string; icon: string; adminOnly?: boolean }

const sellerNav: NavItem[] = [
  { href: '/dashboard', label: 'Overblik', icon: '◈' },
  { href: '/dashboard/sales', label: 'Mine salg', icon: '◎' },
  { href: '/dashboard/log', label: 'Aktivitetslog', icon: '◉' },
  { href: '/dashboard/leaderboard', label: 'Leaderboard', icon: '◆' },
];

const adminNav: NavItem[] = [
  { href: '/admin', label: 'Oversigt', icon: '◈' },
  { href: '/admin/tasks', label: 'Opgaver', icon: '◎' },
  { href: '/admin/sellers', label: 'Sælgere', icon: '◉' },
  { href: '/admin/periods', label: 'Lønperioder', icon: '◇' },
  { href: '/admin/targets', label: 'Targets', icon: '◆' },
  { href: '/admin/revenue', label: 'Omsætning', icon: '◈', adminOnly: true },
];

interface Props {
  role: 'ADMIN' | 'MANAGER' | 'SELLER';
  name: string;
  children: React.ReactNode;
}

export default function AppShell({ role, name, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = role === 'SELLER' ? sellerNav : adminNav;

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

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
          {nav.filter(item => !item.adminOnly || role === 'ADMIN').map(item => {
            const active = item.href === '/admin' || item.href === '/dashboard'
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <a key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 7, marginBottom: 2,
                textDecoration: 'none',
                background: active ? 'rgba(24,95,165,0.2)' : 'transparent',
                color: active ? '#185FA5' : '#667788',
                fontWeight: active ? 600 : 400,
                fontSize: 13,
                transition: 'all 0.12s',
              }}>
                <span style={{ fontSize: 10 }}>{item.icon}</span>
                {item.label}
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
