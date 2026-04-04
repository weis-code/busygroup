import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kundeportal — BusyGroup',
  description: 'Din personlige kundeportal',
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  // Standalone layout — no AppShell, no sidebar
  return (
    <div style={{ minHeight: '100vh', background: '#0C0F14', color: '#ECF0F1', fontFamily: 'inherit' }}>
      {children}
    </div>
  );
}
