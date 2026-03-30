'use client';

import { createContext, useContext, useState, useEffect } from 'react';

export const SIDEBAR_EXPANDED = 220;
export const SIDEBAR_COLLAPSED = 56;

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
  width: number;
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  toggle: () => {},
  width: SIDEBAR_EXPANDED,
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  // Læs fra localStorage ved første render
  useEffect(() => {
    try {
      if (localStorage.getItem('sidebar-collapsed') === 'true') {
        setCollapsed(true);
      }
    } catch { /* SSR */ }
  }, []);

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('sidebar-collapsed', String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <SidebarContext.Provider value={{ collapsed, toggle, width: collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
