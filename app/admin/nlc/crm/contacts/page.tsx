'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NlcCrmContactsPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/crm/contacts'); }, [router]);
  return null;
}
