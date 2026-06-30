'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type CompanySlug = 'nls' | 'meridian' | 'quorex' | 'reminder' | 'group' | 'creatorrate' | 'nlca';

interface CompanyCtx {
  activeCompany: CompanySlug;
  setActiveCompany: (slug: CompanySlug) => void;
}

const VALID: CompanySlug[] = ['nls', 'meridian', 'quorex', 'reminder', 'group', 'creatorrate', 'nlca'];

const CompanyContext = createContext<CompanyCtx>({
  activeCompany: 'nls',
  setActiveCompany: () => {},
});

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [activeCompany, setActive] = useState<CompanySlug>('nls');

  useEffect(() => {
    const saved = localStorage.getItem('activeCompany') as CompanySlug | null;
    if (saved && VALID.includes(saved)) setActive(saved);
  }, []);

  function setActiveCompany(slug: CompanySlug) {
    setActive(slug);
    localStorage.setItem('activeCompany', slug);
  }

  return (
    <CompanyContext.Provider value={{ activeCompany, setActiveCompany }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
