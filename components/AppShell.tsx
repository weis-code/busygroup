'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/lib/UserContext';
import {
  MessageSquare, Settings, LogOut, Building2, ChevronLeft, ChevronRight, LayoutGrid,
} from 'lucide-react';
import TopBar from '@/components/TopBar';

// ─── Design tokens ──────────────────────────────────────────────────────────
const PRIMARY   = '#E84025';          // Orange accent (fra design)
const P_ALPHA   = 'rgba(232,64,37,';  // Orange med alpha-kanal
const BG_SIDE   = '#FFFFFF';          // Sidebar baggrund
const BG_BORDER = 'rgba(0,0,0,0.08)';

const NAV_ITEMS = [
  { label: 'Kunder',        href: '/kunder',    icon: Building2    },
  { label: 'Projekter',     href: '/projects',  icon: LayoutGrid   },
  { label: 'Messenger',     href: '/messenger', icon: MessageSquare },
  { label: 'Indstillinger', href: '/settings',  icon: Settings     },
];

const W_OPEN   = 220;
const W_CLOSED = 56;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useUser();

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
  const isPortal = pathname.startsWith('/portal');
  const w = collapsed ? W_CLOSED : W_OPEN;

  if (isLogin || isPortal) return <>{children}</>;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F1F5F9' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
        width: w,
        background: BG_SIDE,
        borderRight: `1px solid ${BG_BORDER}`,
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
        flexShrink: 0,
      }}>

        {/* ── Logo + collapse ─────────────────────────────────────────── */}
        <div style={{
          height: 56, flexShrink: 0,
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: collapsed ? 0 : '0 10px 0 14px',
          borderBottom: `1px solid ${BG_BORDER}`,
        }}>
          {/* "B" logo — orange afrundet firkant */}
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: `linear-gradient(145deg, ${PRIMARY}, #C4331B)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 800, color: '#fff',
            boxShadow: `0 2px 10px ${P_ALPHA}0.35)`,
            letterSpacing: '-0.5px',
          }}>
            B
          </div>

          {!collapsed && (
            <div style={{ flex: 1, paddingLeft: 10 }}>
              <div style={{ fontWeight: 700, color: '#1E293B', fontSize: '14px', whiteSpace: 'nowrap', letterSpacing: '-0.2px' }}>
                BusyConsulting
              </div>
              <div style={{ fontSize: '10px', color: '#94A3B8', letterSpacing: '0.02em' }}>
                Client Platform
              </div>
            </div>
          )}

          {!collapsed && (
            <button
              onClick={toggle}
              title="Skjul sidebar"
              style={{
                width: 26, height: 26, borderRadius: 6, border: 'none',
                background: 'rgba(0,0,0,0.04)', cursor: 'pointer',
                color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { const b = e.currentTarget; b.style.background = 'rgba(0,0,0,0.08)'; b.style.color = '#475569'; }}
              onMouseLeave={e => { const b = e.currentTarget; b.style.background = 'rgba(0,0,0,0.04)'; b.style.color = '#94A3B8'; }}
            >
              <ChevronLeft size={13} />
            </button>
          )}

          {collapsed && (
            <button
              onClick={toggle}
              title="Udvid sidebar"
              style={{
                position: 'absolute', bottom: 88, left: 0, right: 0,
                margin: '0 auto', width: 26, height: 26, borderRadius: 6, border: 'none',
                background: 'rgba(0,0,0,0.04)', cursor: 'pointer',
                color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { const b = e.currentTarget; b.style.background = 'rgba(0,0,0,0.08)'; b.style.color = '#475569'; }}
              onMouseLeave={e => { const b = e.currentTarget; b.style.background = 'rgba(0,0,0,0.04)'; b.style.color = '#94A3B8'; }}
            >
              <ChevronRight size={13} />
            </button>
          )}
        </div>

        {/* ── Nav items ───────────────────────────────────────────────── */}
        <nav style={{
          flex: 1, padding: '10px 8px',
          display: 'flex', flexDirection: 'column', gap: 1,
          overflowY: 'auto', overflowX: 'hidden',
        }}>
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href));
            const badge = 0;
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  gap: collapsed ? 0 : 10,
                  padding: collapsed ? '9px 0' : '7px 10px',
                  borderRadius: 8,
                  background: active ? `${P_ALPHA}0.14)` : 'transparent',
                  color: active ? '#1E293B' : '#94A3B8',
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  textDecoration: 'none',
                  transition: 'background 0.12s, color 0.12s',
                  borderLeft: active && !collapsed ? `2px solid ${PRIMARY}` : '2px solid transparent',
                  whiteSpace: 'nowrap',
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(0,0,0,0.05)';
                    (e.currentTarget as HTMLAnchorElement).style.color = '#475569';
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                    (e.currentTarget as HTMLAnchorElement).style.color = '#94A3B8';
                  }
                }}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon
                    size={collapsed ? 18 : 15}
                    style={{ color: active ? PRIMARY : 'inherit' }}
                  />
                  {badge > 0 && (
                    <span style={{
                      position: 'absolute', top: collapsed ? -6 : -5, right: collapsed ? -8 : -8,
                      background: PRIMARY, color: '#fff',
                      fontSize: 9, fontWeight: 800,
                      borderRadius: 8, padding: '1px 4px',
                      lineHeight: 1.3, minWidth: 14, textAlign: 'center',
                    }}>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </div>
                {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
                {!collapsed && badge > 0 && (
                  <span style={{ background: 'rgba(232,64,37,0.18)', color: PRIMARY, fontSize: 10, fontWeight: 700, borderRadius: 8, padding: '1px 6px' }}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── Bruger + logout ─────────────────────────────────────────── */}
        {user && (
          <div style={{
            borderTop: `1px solid ${BG_BORDER}`,
            padding: collapsed ? '10px 8px' : '10px 8px',
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: collapsed ? 0 : 9,
              padding: collapsed ? '4px 0' : '4px 6px',
            }}>
              {/* Avatar med orange gradient (matcher design) */}
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: `linear-gradient(135deg, ${PRIMARY}, #C4331B)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800, color: '#fff',
                boxShadow: `0 1px 6px ${P_ALPHA}0.4)`,
              }}>
                {user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              {!collapsed && (
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#1E293B', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.name}
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 700,
                    color: user.role === 'admin' ? PRIMARY : '#94A3B8',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    {user.role === 'admin' ? 'Admin' : 'Bruger'}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={logout}
              title={collapsed ? 'Log ud' : undefined}
              style={{
                display: 'flex', alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: collapsed ? 0 : 8,
                padding: collapsed ? '7px 0' : '6px 8px',
                borderRadius: 7, border: 'none',
                background: 'transparent', color: '#94A3B8',
                fontSize: 12, cursor: 'pointer', width: '100%',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => {
                const b = e.currentTarget;
                b.style.background = 'rgba(232,64,37,0.08)';
                b.style.color = PRIMARY;
              }}
              onMouseLeave={e => {
                const b = e.currentTarget;
                b.style.background = 'transparent';
                b.style.color = '#94A3B8';
              }}
            >
              <LogOut size={collapsed ? 15 : 13} style={{ flexShrink: 0 }} />
              {!collapsed && 'Log ud'}
            </button>
          </div>
        )}
      </aside>

      {/* ── Indhold ─────────────────────────────────────────────────────── */}
      <main style={{
        marginLeft: w,
        flex: 1,
        minHeight: '100vh',
        transition: 'margin-left 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        background: '#F1F5F9',
      }}>
        <TopBar />
        <div style={{ flex: 1 }}>
          {children}
        </div>
      </main>
    </div>
  );
}
