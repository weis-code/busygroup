'use client';

import { useSidebar } from '@/lib/SidebarContext';
import { usePathname } from 'next/navigation';

export default function MainContent({ children }: { children: React.ReactNode }) {
  const { width } = useSidebar();
  const pathname = usePathname();

  // Login-siden har ingen sidebar
  const noSidebar = pathname === '/login';

  return (
    <main style={{
      marginLeft: noSidebar ? '0' : `${width}px`,
      minHeight: '100vh',
      transition: 'margin-left 0.2s ease',
    }}>
      {children}
    </main>
  );
}
