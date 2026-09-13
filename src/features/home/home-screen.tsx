'use client';
/**
 * S-12 ホーム（F-20）。次の楽しみ・確認待ち・今週の予定・楽しかった体験・10年後の生活を1画面に出す。
 * 仕様: mvp-spec 第5章 D群、A案 ②③、B案 FR-09・S-06。
 * 今月の回数とツリーの進み具合は W5（Issue #10 の範囲外）。
 */
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getFeatureMode } from '@/config/features';
import { ModeBanner, ScreenHeading } from '@/features/reflection/ui';
import { useStoredState } from '@/features/reflection/use-stored-state';
import { formatRange } from '@/features/reservation/logic';
import type { Action, ReserveState } from '@/shared/types';
import {
  awaitingActions,
  enjoyed,
  futureLifeLine,
  hasSavedData,
  nextPleasure,
  statusLabel,
  weeklyActions,
} from './logic';
import { SAMPLE_VARIANTS, isSampleVariant, sampleHomeState, type SampleVariant } from './sample';

export function HomeScreen() {
  const params = useSearchParams();
  const stored = useStoredState();
  if (stored === null) return <p className="text-sm text-[var(--muted)]">読み込んでいます…</p>;

  const requested = params.get('sample');
  const variant: SampleVariant | null = isSampleVariant(requested) ? requested : null;
  const isSample = variant !== null;
  const state: ReserveState = isSample ? sampleHomeState(variant) : stored.data;
  const now = new Date();

  const next = nextPleasure(state, now);
  const awaiting = awaitingActions(state, now);
  const weekly = weeklyActions(state);
  const highlights = enjoyed(state);
  const futureLine = futureLifeLine(state);
  const empty = !hasSavedData(state);

  return (
    <>
      <ModeBanner
        mode={getFeatureMode('F-20')}
        sample={isSample}
        sampleText="サンプル：見本のデータで表示しています。この画面では保存しません。"
        mockText="この画面は、この端末に保存した記録だけを表示しています。"
      />
      <section className="screen-panel">
        <ScreenHeading screenId="S-12" />
        {stored.error && <p className="notice mb-4">{stored.error}</p>}

        {next ? (
          <div className="ticket-preview">
            <p className="!mb-2 !text-xl">{next.title}</p>
            <p className="!mb-2 !text-sm !font-normal text-[var(--muted)]">
              {next.start ? formatRange(next.start, next.end) : '日時未設定'}
              {next.place && ` ／ ${next.place}`} ／ {next.durationMin}分
            </p>
            <p className="!mb-0 !text-sm !font-normal">{statusLabel(next, state.records, now)}</p>
            <small>
              {next.startMessage || '自分のための時間です。'}
              <br />
              気が重いときは：{next.fallback}
            </small>
            <div className="secondary-links">
              <Link href={`/ticket/${next.id}`}>予約票を見る</Link>
              <Link href="/schedule">日時を変える</Link>
            </div>
          </div>
        ) : (
          <div className="ticket-preview">
            <p className="!mb-2 !text-lg">今週の予定はまだありません</p>
            <small className="!border-0 !pt-0">
              {empty
                ? 'やってみたいことから、小さな一歩をひとつ決めましょう。'
                : '次の一歩を決めると、ここに出ます。'}
            </small>
            <div className="secondary-links">
              <Link href={empty ? '/' : '/schedule'}>{empty ? 'はじめる' : '日時を決める'}</Link>
            </div>
          </div>
        )}

        {awaiting.length > 0 && (
          <section className="mb-7">
            <h2 className="mb-1 text-sm font-semibold">確認待ち</h2>
            <p className="mb-3 text-xs text-[var(--muted)]">
              終了の時刻を過ぎた予定です。できたかどうかは、あなたにしか分かりません。
            </p>
            <ul className="m-0 list-none p-0">
              {awaiting.map(action => (
                <li key={action.id} className="border-b border-[#e8eade] py-3">
                  <ActionLine action={action} label="確認待ち" />
                  <Link
                    href={`/reflect/${action.id}`}
                    className="mt-2 inline-flex min-h-[44px] items-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white"
                  >
                    記録する
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {weekly.length > 0 && (
          <section className="mb-7">
            <h2 className="mb-1 text-sm font-semibold">今週の予定</h2>
            <p className="mb-3 text-xs text-[var(--muted)]">最大3件です。日時が決まっていないものは下にまとめています。</p>
            <ul className="m-0 list-none p-0">
              {weekly.map(action => (
                <li key={action.id} className="border-b border-[#e8eade] py-3">
                  <ActionLine action={action} label={statusLabel(action, state.records, now)} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {highlights.length > 0 && (
          <section className="mb-7">
            <h2 className="mb-1 text-sm font-semibold">楽しかった体験・またやりたいこと</h2>
            <p className="mb-3 text-xs text-[var(--muted)]">あなたが記録したものだけを出しています。</p>
            <ul className="m-0 list-none p-0">
              {highlights.map(item => (
                <li key={item.record.id} className="border-b border-[#e8eade] py-3 text-sm">
                  <span className="font-semibold">{item.title}</span>
                  {item.record.memo && (
                    <span className="mt-1 block text-xs text-[var(--muted)]">「{item.record.memo}」</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {futureLine && (
          <section className="mb-7">
            <h2 className="mb-1 text-sm font-semibold">10年後の生活</h2>
            <p className="m-0 text-sm">{futureLine}</p>
          </section>
        )}

        <div className="secondary-links">
          <Link href="/tree">ツリーを見る</Link>
          <Link href="/history">これまでの一歩</Link>
          <Link href="/settings">設定</Link>
        </div>

        {isSample && (
          <details className="route-directory mt-6">
            <summary>見本の表示を切り替える</summary>
            <nav aria-label="見本の状態">
              <ul>
                {SAMPLE_VARIANTS.map(item => (
                  <li key={item.value}>
                    <Link href={`/home?sample=${item.value}`}>
                      <span>{item.value}</span>
                      {item.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/home">
                    <span>保存</span>
                    この端末の記録に戻す
                  </Link>
                </li>
              </ul>
            </nav>
          </details>
        )}
      </section>
    </>
  );
}

function ActionLine({ action, label }: { action: Action; label: string }) {
  return (
    <>
      <span className="block text-sm font-semibold">{action.title}</span>
      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
        <span>{action.start ? formatRange(action.start, action.end) : '日時未設定'}</span>
        <span>{action.durationMin}分</span>
        <span className="rounded-full bg-[#e8eade] px-2 py-0.5 text-[var(--ink)]">{label}</span>
      </span>
    </>
  );
}
