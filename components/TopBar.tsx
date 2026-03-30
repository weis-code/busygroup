'use client';

import { usePathname } from 'next/navigation';
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

  const pageName = PAGE_NAMES[pathname] ?? 'BusyGroup';

  const initials = user?.name
    ? user.name
        .split(' ')
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase()
    : 'MB';

  const today = new Date().getDate();

  return (
    <div
      style={{
        height: 48,
        background: '#080F16',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0,
      }}
    >
      {/* Left: Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <span style={{ color: '#334455', fontSize: 12 }}>BusyGroup</span>
        <span style={{ color: '#223344', fontSize: 12, margin: '0 4px' }}>/</span>
        <span style={{ color: '#334455', fontSize: 12 }}>BusyConsulting</span>
        <span style={{ color: '#223344', fontSize: 12, margin: '0 4px' }}>/</span>
        <span style={{ color: '#AAB8C2', fontSize: 12, fontWeight: 500 }}>{pageName}</span>
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Search bar */}
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 7,
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: 200,
            boxSizing: 'border-box',
          }}
        >
          <Search size={12} color="#334455" />
          <span style={{ color: '#334455', fontSize: 12, flex: 1 }}>Søg i alt...</span>
          <span
            style={{
              color: '#223344',
              fontSize: 11,
              background: 'rgba(255,255,255,0.05)',
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
            color: '#445566',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bell size={15} />
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
        </button>

        {/* Date badge */}
        <div
          style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 7,
            padding: '5px 10px',
            fontSize: 12,
            fontWeight: 600,
            color: '#AAB8C2',
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
            background: 'linear-gradient(135deg, #E74C3C, #C0392B)',
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
