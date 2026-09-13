import Link from 'next/link';
import { screenRoutes, type ScreenId } from '@/config/routes';

export function ScreenShell({ screenId, children }: { screenId: ScreenId; children?: React.ReactNode }) {
  const screen = screenRoutes.find(item => item.id === screenId)!;
  const concept = screenId.startsWith('G-');
  return (
    <>
      <div className="mode-banner" role="status">{concept ? '構想デモ（実際のデータではありません）' : 'サンプル：画面の準備中です'}</div>
      <section className="screen-panel">
        <p className="eyebrow">RESERVE MACHINE <span>{screenId}</span></p>
        <h1>{screen.title}</h1>
        <p className="intro">{screen.description}</p>
        <div className="ticket-preview" aria-label="画面の準備状況">
          <span className="ticket-mark" aria-hidden="true">✦</span>
          <p>あなたの未来に、<br />小さな予約を。</p>
          <small>この画面は現在、準備中です。<br />実際の予約やAIによる提案は行いません。</small>
        </div>
        {children}
        <Link className="primary-link" href={screen.next}>次の画面を見る <span aria-hidden="true">→</span></Link>
        {screenId === 'S-02' && <div className="secondary-links"><Link href="/tomorrow">まだ分からない</Link><Link href="/blank">これからの時間を見る</Link></div>}
      </section>
      <details className="route-directory"><summary>画面一覧を見る</summary><nav aria-label="全画面"><ul>{screenRoutes.map(route => <li key={route.id}><Link href={route.path}><span>{route.id}</span>{route.title}</Link></li>)}</ul></nav></details>
    </>
  );
}
