'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Search, Bell } from 'lucide-react';
import { useUser } from '@/lib/UserContext';

const PAGE_NAMES: Record<string, string> = {
  '/': 'Dashboard',
  '/crm': 'CRM & Salg',
  '/kunder': 'Kunder',
  '/pipeline': 'Agenter',
  '/mail': 'Mail',
  '/messenger': 'Beskeder',
  '/calendar': 'Kalender',
  '/settings': 'Indstillinger',
};

export default function TopBar() {
  const pathname = usePathname();
  const { user } = useUser();

  const pageName = PAGE_NAMES[pathname] ?? 'BusyConsulting';

  const initials = user?.name
    ? user.name
        .split(' ')
        .slice(0, 2)
        .map((part: string) => part[0])
        .join('')
        .toUpperCase()
    : 'BC';

  const today = new Date().getDate();

  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const check = () => fetch('/api/chat/unread').then(r => r.ok ? r.json() : { unread: 0 }).then(d => setUnread(d.unread)).catch(() => {});
    check();
    const t = setInterval(check, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      style={{
        height: 48,
        background: '#FFFFFF',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0,
      }}
    >
      {/* Left: Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <span style={{ color: '#94A3B8', fontSize: 12 }}>BusyConsulting</span>
        <span style={{ color: '#CBD5E1', fontSize: 12, margin: '0 4px' }}>/</span>
        <span style={{ color: '#475569', fontSize: 12, fontWeight: 500 }}>{pageName}</span>
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Search bar */}
        <div
          style={{
            background: '#F8FAFC',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 7,
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: 200,
            boxSizing: 'border-box',
          }}
        >
          <Search size={12} color="#94A3B8" />
          <span style={{ color: '#94A3B8', fontSize: 12, flex: 1 }}>Søg i alt...</span>
          <span
            style={{
              color: '#CBD5E1',
              fontSize: 11,
              background: 'rgba(0,0,0,0.04)',
              borderRadius: 4,
              padding: '1px 5px',
            }}
          >
            ⌘K
          </span>
        </div>

        {/* Bell button */}
        <button
          style={{
            position: 'relative',
            width: 34,
            height: 34,
            borderRadius: 7,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: unread > 0 ? '#1E293B' : '#94A3B8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bell size={15} />
          {unread > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#E74C3C',
              }}
            />
          )}
        </button>

        {/* Date badge */}
        <div
          style={{
            background: '#F1F5F9',
            borderRadius: 7,
            padding: '5px 10px',
            fontSize: 12,
            fontWeight: 600,
            color: '#475569',
          }}
        >
          {today}
        </div>

        {/* User avatar */}
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #E84025, #C4331B)',
            color: 'white',
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          {initials}
        </div>
      </div>
    </div>
  );
}
