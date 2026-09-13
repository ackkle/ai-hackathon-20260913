import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'リザーブマシン',
  description: '空白が来る前に、10年後の楽しみを予約する。',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
