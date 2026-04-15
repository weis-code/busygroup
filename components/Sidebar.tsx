'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/lib/UserContext';
import { useSidebar } from '@/lib/SidebarContext';
import {
  LayoutDashboard, TrendingUp, MessageSquare,
  Settings, LogOut, Building2, ChevronLeft, ChevronRight, Bot,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Oversigt',      href: '/',          icon: LayoutDashboard },
  { label: 'Messenger',     href: '/messenger',  icon: MessageSquare   },
  { label: 'CRM',           href: '/crm',        icon: TrendingUp      },
  { label: 'Agenter',       href: '/agenter',    icon: Bot             },
  { label: 'Kunder',        href: '/kunder',     icon: Building2       },
  { label: 'Indstillinger', href: '/settings',   icon: Settings        },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useUser();
  const { collapsed, toggle, width } = useSidebar();

  if (pathname === '/login') return null;

  const c = collapsed; // kortere alias

  return (
    <aside style={{
      position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
      width: `${width}px`,
      background: '#080F16',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.2s ease',
      overflow: 'hidden',
    }}>

      {/* Logo + collapse-knap */}
      <div style={{
        height: '56px', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center',
        justifyContent: c ? 'center' : 'space-between',
        padding: c ? '0' : '0 12px 0 18px',
      }}>
        {!c && (
          <div>
            <div style={{ fontWeight: 700, color: '#ECF0F1', fontSize: '15px', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
              BusyGroup
            </div>
            <div style={{ fontSize: '10px', color: '#445566' }}>Agent Dashboard</div>
          </div>
        )}
        <button
          onClick={toggle}
          title={c ? 'Udvid menu' : 'Skjul menu'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#445566', padding: '6px', borderRadius: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color 0.12s, background 0.12s',
            flexShrink: 0,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ECF0F1'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#445566'; (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
        >
          {c ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: c ? '10px 8px' : '10px 8px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto', overflowX: 'hidden' }}>
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              title={c ? label : undefined}
              style={{
                display: 'flex', alignItems: 'center',
                gap: c ? '0' : '10px',
                justifyContent: c ? 'center' : 'flex-start',
                padding: c ? '10px 0' : '8px 10px',
                borderRadius: '7px',
                background: active ? 'rgba(24,95,165,0.18)' : 'transparent',
                color: active ? '#ECF0F1' : '#556677',
                fontSize: '13px', fontWeight: active ? 600 : 400,
                textDecoration: 'none',
                transition: 'all 0.12s',
                borderLeft: active && !c ? '2px solid #185FA5' : '2px solid transparent',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.04)';
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
              <Icon size={c ? 18 : 15} style={{ flexShrink: 0 }} />
              {!c && label}
            </Link>
          );
        })}
      </nav>

      {/* User + logout */}
      {user && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: c ? '10px 8px' : '10px',
          display: 'flex', flexDirection: 'column', gap: '4px',
        }}>
          {/* Avatar + navn */}
          <div style={{
            display: 'flex', alignItems: 'center',
            gap: c ? '0' : '8px',
            justifyContent: c ? 'center' : 'flex-start',
            padding: c ? '4px 0' : '4px 6px',
          }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
              background: 'rgba(24,95,165,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 700, color: '#185FA5',
            }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            {!c && (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '12px', color: '#ECF0F1', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.name}
                </div>
                <div style={{
                  fontSize: '10px', fontWeight: 600,
                  color: user.role === 'admin' ? '#E74C3C' : '#185FA5',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {user.role === 'admin' ? 'Admin' : 'Sælger'}
                </div>
              </div>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            title={c ? 'Log ud' : undefined}
            style={{
              display: 'flex', alignItems: 'center',
              justifyContent: c ? 'center' : 'flex-start',
              gap: c ? '0' : '8px',
              padding: c ? '8px 0' : '6px 8px',
              borderRadius: '6px', border: 'none',
              background: 'transparent', color: '#445566', fontSize: '12px',
              cursor: 'pointer', width: '100%',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(231,76,60,0.1)'; (e.currentTarget as HTMLButtonElement).style.color = '#E74C3C'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#445566'; }}
          >
            <LogOut size={c ? 16 : 13} style={{ flexShrink: 0 }} />
            {!c && 'Log ud'}
          </button>
        </div>
      )}
    </aside>
  );
}
