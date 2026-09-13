'use client';
/**
 * S-02 入口（F-01・F-33）。願いを書く／まだ分からない／記録から見つける（構想デモ）の3つの入口。
 */
import Link from 'next/link';
import { getFeatureMode } from '@/config/features';
import { ModeBanner, ScreenHeading } from '@/features/reflection/ui';
import { SEND_NOTICE } from './logic';

const ENTRIES: { href: string; glyph: string; title: string; caption: string; concept?: boolean }[] = [
  { href: '/wish', glyph: '✏', title: '願いを書く', caption: '「お金持ちになりたい」「何かしたい」でも大丈夫' },
  { href: '/tomorrow', glyph: '🌱', title: 'まだ分からない', caption: '明日の過ごし方から一緒に探します' },
  { href: '/concept/records', glyph: '🔍', title: '記録から見つける', caption: '見ている動画などから気づいていない関心を探します', concept: true },
];

export function EntryScreen() {
  return (
    <>
      <ModeBanner mode={getFeatureMode('F-01')} mockText="サンプル：どの入口からでも試せます。" />
      <section className="screen-panel">
        <ScreenHeading screenId="S-02" />
        <div className="flex flex-col gap-3 mb-6">
          {ENTRIES.map(entry => (
            <Link
              key={entry.href}
              href={entry.href}
              className="flex items-start gap-3 rounded-2xl border border-[#d8e1d3] bg-white p-4 hover:bg-[#f3f6ee]"
            >
              <span className="text-2xl leading-none" aria-hidden="true">{entry.glyph}</span>
              <span className="flex-1">
                <span className="flex items-center gap-2 font-semibold">
                  {entry.title}
                  {entry.concept && (
                    <span className="rounded-full bg-[#f4eacb] px-2 py-0.5 text-[11px] font-normal text-[#674f18]">
                      構想デモ
                    </span>
                  )}
                </span>
                <span className="block text-sm text-[var(--muted)] mt-1">{entry.caption}</span>
              </span>
            </Link>
          ))}
        </div>
        <p className="text-xs text-[var(--muted)] mb-6">{SEND_NOTICE}</p>
        <div className="secondary-links">
          <Link href="/blank">これからの空白を先に見る</Link>
        </div>
      </section>
    </>
  );
}
