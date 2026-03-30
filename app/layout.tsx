import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';
import AppShell from '@/components/AppShell';
import { UserProvider } from '@/lib/UserContext';

export const metadata: Metadata = {
  title: 'BusyGroup',
  description: 'AI Sales Agent Dashboard',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="BusyGroup" />
        <meta name="theme-color" content="#080F16" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body style={{ background: '#0F1923', color: '#ECF0F1', margin: 0, minHeight: '100vh' }}>
        <UserProvider>
          <AppShell>
            {children}
          </AppShell>
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#1A2A38',
                border: '1px solid rgba(255,255,255,0.07)',
                color: '#ECF0F1',
              },
            }}
          />
        </UserProvider>
      </body>
    </html>
  );
}
