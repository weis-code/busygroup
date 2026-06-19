import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import AppShell from '@/components/AppShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'SELLER') redirect('/dashboard');

  return (
    <AppShell role={session.role} name={session.name}>
      {children}
    </AppShell>
  );
}
