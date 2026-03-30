'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/lib/UserContext';
import {
  LayoutDashboard, TrendingUp, MessageSquare,
  Settings, LogOut, Bot, Building2,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Oversigt', href: '/', icon: LayoutDashboard },
  { label: 'Messenger', href: '/messenger', icon: MessageSquare },
  { label: 'CRM', href: '/crm', icon: TrendingUp },
  { label: 'Kunder', href: '/kunder', icon: Building2 },
  { label: 'Agenter', href: '/pipeline', icon: Bot },
  { label: 'Indstillinger', href: '/settings', icon: Settings },
];

export const SIDEBAR_WIDTH = 220;

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useUser();

  if (pathname === '/login') return null;

  return (
    <aside style={{
      position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
      width: `${SIDEBAR_WIDTH}px`,
      background: '#080F16',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 18px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ fontWeight: 700, color: '#ECF0F1', fontSize: '16px', letterSpacing: '-0.02em' }}>
          BusyGroup
        </div>
        <div style={{ fontSize: '11px', color: '#445566', marginTop: '2px' }}>Agent Dashboard</div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 10px', borderRadius: '7px',
              background: active ? 'rgba(24,95,165,0.18)' : 'transparent',
              color: active ? '#ECF0F1' : '#556677',
              fontSize: '13px', fontWeight: active ? 600 : 400,
              textDecoration: 'none',
              transition: 'all 0.12s',
              borderLeft: active ? '2px solid #185FA5' : '2px solid transparent',
            }}
            onMouseEnter={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLAnchorElement).style.color = '#ECF0F1'; }}
            onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = '#556677'; } }}
            >
              <Icon size={15} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      {user && (
        <div style={{
          padding: '12px 10px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'rgba(24,95,165,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 700, color: '#185FA5', flexShrink: 0,
            }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
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
          </div>
          <button
            onClick={logout}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 10px', borderRadius: '6px', border: 'none',
              background: 'transparent', color: '#445566', fontSize: '12px',
              cursor: 'pointer', width: '100%', textAlign: 'left',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(231,76,60,0.1)'; (e.currentTarget as HTMLButtonElement).style.color = '#E74C3C'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#445566'; }}
          >
            <LogOut size={13} /> Log ud
          </button>
        </div>
      )}
    </aside>
  );
}
