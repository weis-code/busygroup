import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Next Level Sales',
  description: 'BusyGroup Sales Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <body>{children}</body>
    </html>
  );
}
