'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/lib/UserContext';
import {
  LayoutDashboard, TrendingUp, MessageSquare, Mail, Calendar,
  Settings, LogOut, Bot, Building2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import TopBar from '@/components/TopBar';

const NAV_ITEMS = [
  { label: 'Oversigt',      href: '/',           icon: LayoutDashboard },
  { label: 'Messenger',     href: '/messenger',   icon: MessageSquare   },
  { label: 'Mail',          href: '/mail',        icon: Mail            },
  { label: 'Kalender',      href: '/calendar',    icon: Calendar        },
  { label: 'CRM',           href: '/crm',         icon: TrendingUp      },
  { label: 'Kunder',        href: '/kunder',      icon: Building2       },
  { label: 'Agenter',       href: '/pipeline',    icon: Bot             },
  { label: 'Indstillinger', href: '/settings',    icon: Settings        },
];

const W_OPEN = 220;
const W_CLOSED = 56;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useUser();
  // Læs fra localStorage synkront ved første render (lazy init)
  // Undgår flash og fungerer korrekt på alle sider
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem('sb') === '1'; } catch { return false; }
  });

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('sb', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const isLogin = pathname === '/login';
  const w = collapsed ? W_CLOSED : W_OPEN;

  if (isLogin) return <>{children}</>;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
        width: w,
        background: '#080F16',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
        flexShrink: 0,
      }}>

        {/* Logo + toggle */}
        <div style={{
          height: 56, flexShrink: 0,
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: collapsed ? 0 : '0 10px 0 18px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {!collapsed && (
            <div>
              <div style={{ fontWeight: 700, color: '#ECF0F1', fontSize: '15px', whiteSpace: 'nowrap' }}>BusyGroup</div>
              <div style={{ fontSize: '10px', color: '#445566' }}>Agent Dashboard</div>
            </div>
          )}
          <button
            onClick={toggle}
            title={collapsed ? 'Udvid' : 'Skjul'}
            style={{
              width: 32, height: 32, borderRadius: 7, border: 'none',
              background: 'rgba(255,255,255,0.05)', cursor: 'pointer',
              color: '#778899', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLButtonElement).style.color = '#ECF0F1'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = '#778899'; }}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', overflowX: 'hidden' }}>
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  gap: collapsed ? 0 : 10,
                  padding: collapsed ? '10px 0' : '8px 10px',
                  borderRadius: 7,
                  background: active ? 'rgba(24,95,165,0.18)' : 'transparent',
                  color: active ? '#ECF0F1' : '#556677',
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  textDecoration: 'none',
                  transition: 'background 0.12s, color 0.12s',
                  borderLeft: active && !collapsed ? '2px solid #185FA5' : '2px solid transparent',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.05)';
                    (e.currentTarget as HTMLAnchorElement).style.color = '#ECF0F1';
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                    (e.currentTarget as HTMLAnchorElement).style.color = '#556677';
                  }
                }}
              >
                <Icon size={collapsed ? 18 : 15} style={{ flexShrink: 0 }} />
                {!collapsed && label}
              </Link>
            );
          })}
        </nav>

        {/* Bruger + logout */}
        {user && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: collapsed ? '10px 6px' : '10px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: collapsed ? 0 : 8, padding: collapsed ? '4px 0' : '4px 6px' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(24,95,165,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#185FA5',
              }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              {!collapsed && (
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#ECF0F1', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: user.role === 'admin' ? '#E74C3C' : '#185FA5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {user.role === 'admin' ? 'Admin' : 'Sælger'}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={logout}
              title={collapsed ? 'Log ud' : undefined}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: collapsed ? 0 : 8,
                padding: collapsed ? '8px 0' : '6px 8px', borderRadius: 6, border: 'none',
                background: 'transparent', color: '#445566', fontSize: 12, cursor: 'pointer', width: '100%',
                transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(231,76,60,0.1)'; (e.currentTarget as HTMLButtonElement).style.color = '#E74C3C'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#445566'; }}
            >
              <LogOut size={collapsed ? 16 : 13} style={{ flexShrink: 0 }} />
              {!collapsed && 'Log ud'}
            </button>
          </div>
        )}
      </aside>

      {/* ── Indhold ─────────────────────────────────────────── */}
      <main style={{
        marginLeft: w,
        flex: 1,
        minHeight: '100vh',
        transition: 'margin-left 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <TopBar />
        <div style={{ flex: 1 }}>
          {children}
        </div>
      </main>
    </div>
  );
}
