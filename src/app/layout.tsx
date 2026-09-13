import type { Metadata } from 'next';
import Link from 'next/link';
import { StorageNotice } from '@/features/foundation/storage-notice';
import './globals.css';

export const metadata: Metadata = { title: 'リザーブマシン | 明日が楽しみになる', description: '小さな「やってみたい」を、生きがいにつなげる。AIハッカソン・チーム15。' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body><div className="app-shell"><header className="app-header"><Link href="/" className="brand"><span aria-hidden="true">✦</span> リザーブマシン</Link><Link href="/settings" className="settings-link">設定</Link></header><main><StorageNotice />{children}</main><footer>TEAM 15 <span>あなたのペースで、明日の楽しみを。</span></footer></div></body></html>;
}
