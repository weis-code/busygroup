'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { CompanySlug } from '@/lib/company-context';

const VALID: CompanySlug[] = ['nls', 'meridian', 'group'];

export default function AdminRedirect() {
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem('activeCompany') as CompanySlug | null;
    const slug = saved && VALID.includes(saved) ? saved : 'nls';
    router.replace(`/admin/${slug}`);
  }, [router]);

  return <div style={{ padding: 40, color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>;
}
