import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';
import AppShell from '@/components/AppShell';
import { UserProvider } from '@/lib/UserContext';

export const metadata: Metadata = {
  title: 'BusyConsulting',
  description: 'Client Platform',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="BusyConsulting" />
        <meta name="theme-color" content="#F1F5F9" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body style={{ background: '#F1F5F9', color: '#1E293B', margin: 0, minHeight: '100vh' }}>
        <UserProvider>
          <AppShell>
            {children}
          </AppShell>
          <Toaster
            theme="light"
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#FFFFFF',
                border: '1px solid rgba(0,0,0,0.08)',
                color: '#1E293B',
              },
            }}
          />
        </UserProvider>
      </body>
    </html>
  );
}
