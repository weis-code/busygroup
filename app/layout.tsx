import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';
import Nav from '@/components/Nav';
import { UserProvider } from '@/lib/UserContext';

export const metadata: Metadata = {
  title: 'BusyGroup Agent Dashboard',
  description: 'AI Sales Agent Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <body style={{ background: '#0F1923', color: '#ECF0F1', margin: 0, minHeight: '100vh' }}>
        <UserProvider>
          <Nav />
          <main style={{ paddingTop: '44px' }}>
            {children}
          </main>
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
