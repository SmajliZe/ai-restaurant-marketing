import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'AI Restaurant Marketing',
  description: 'Marketing automation platform for restaurants.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-surface min-h-screen text-slate-100 antialiased">{children}</body>
    </html>
  );
}
