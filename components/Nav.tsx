'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/lib/UserContext';

const tabs = [
  { label: 'Kunder', href: '/kunder' },
  { label: 'Messenger', href: '/messenger' },
  { label: 'Indstillinger', href: '/settings' },
];

export default function Nav() {
  const pathname = usePathname();
  const [time, setTime] = useState('');
  const { user, logout } = useUser();

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  // Don't render nav on login page
  if (pathname === '/login') return null;

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: '44px', background: '#0A1219',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px',
    }}>
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '200px' }}>
        <span style={{ fontWeight: 700, color: '#ECF0F1', fontSize: '14px' }}>BusyGroup</span>
      </div>

      {/* Center tabs */}
      <div style={{ display: 'flex', gap: '2px' }}>
        {tabs.map(tab => {
          const active = pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href));
          return (
            <Link key={tab.href} href={tab.href} style={{
              padding: '0 16px', height: '44px', display: 'flex', alignItems: 'center',
              fontSize: '13px', fontWeight: active ? 600 : 400,
              color: active ? '#ECF0F1' : '#667788',
              borderBottom: active ? '2px solid #185FA5' : '2px solid transparent',
              textDecoration: 'none',
              transition: 'color 0.15s',
            }}>
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '200px', justifyContent: 'flex-end' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#667788' }}>{time}</span>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid rgba(255,255,255,0.07)', paddingLeft: '12px' }}>
            {/* Role badge */}
            <span style={{
              fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
              background: user.role === 'admin' ? 'rgba(231,76,60,0.15)' : 'rgba(24,95,165,0.15)',
              color: user.role === 'admin' ? '#E74C3C' : '#185FA5',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              {user.role === 'admin' ? 'Admin' : 'Bruger'}
            </span>
            {/* User name */}
            <span style={{ fontSize: '12px', color: '#ECF0F1', fontWeight: 500 }}>
              {user.name.split(' ')[0]}
            </span>
            {/* Logout */}
            <button
              onClick={logout}
              title="Log ud"
              style={{
                background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px',
                padding: '3px 8px', color: '#667788', fontSize: '11px', cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = '#ECF0F1'; (e.target as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.25)'; }}
              onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = '#667788'; (e.target as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
            >
              Log ud
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
