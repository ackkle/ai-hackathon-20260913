'use client';
/**
 * S-10 予約票（F-15）。項目は A案 §5、C案 §8 の値札欄、カレンダーの登録状態（B案 FR-08）。
 * 値札の金額（初期費用・月額・週の時間）と数字の計算は W4（#23）。ここでは枠だけ置く。
 * 実際にカレンダーに入っていない予定を「登録済み」と表示しない（第14.1節）。
 */
import Link from 'next/link';
import { getFeatureMode } from '@/config/features';
import { ModeBanner, ScreenHeading } from '@/features/reflection/ui';
import { useStoredState } from '@/features/reflection/use-stored-state';
import { findAction, formatRange } from './logic';
import { sampleReservation } from './sample';

export function TicketScreen({ actionId }: { actionId: string }) {
  const stored = useStoredState();
  if (stored === null) return <p className="text-sm text-[var(--muted)]">読み込んでいます…</p>;

  const state = stored.data;
  const savedAction = findAction(state, actionId);
  const isSample = savedAction === null;
  const action = savedAction ?? sampleReservation(actionId);
  const wish = isSample ? null : state.wish;
  const registered = action.calendar.confirmedAt !== null;
  const calendarMode = getFeatureMode('F-16');

  return (
    <>
      <ModeBanner
        mode={getFeatureMode('F-15')}
        sample={isSample}
        sampleText="サンプル：保存された行動が見つからないため、見本の予約票を表示しています。"
        mockText="サンプル：10年後の生活の値札（初期費用・月額・週の時間）はこのあとの画面で計算します。"
      />
      <section className="screen-panel">
        <ScreenHeading screenId="S-10" />
        {stored.error && <p className="notice mb-4">{stored.error}</p>}

        <div className="ticket-preview">
          <p className="!text-base !mb-2">
            {action.isFirstDay && <span className="ticket-mark">最初の1日</span>}
            予約番号 {action.reservationNo ?? '未発番'}
          </p>

          <Row label="やりたいこと" value={wish?.text ?? (isSample ? '陶芸をやってみたい' : '未入力')} />
          {/* A案 §5：自分の理由は未回答なら表示を省略する */}
          {wish?.reason && <Row label="自分の理由" value={wish.reason} />}
          <Row label="今回の一歩" value={action.title} />
          <Row
            label="日時・所要時間"
            value={
              action.start
                ? `${formatRange(action.start, action.end)}・${action.durationMin}分`
                : `日時はまだ決まっていません・${action.durationMin}分`
            }
          />
          <Row label="場所" value={action.place || '未定'} />
          <Row label="準備" value={action.prep.length > 0 ? action.prep.join('、') : '特にありません'} />
          <Row label="気が重いときは" value={action.fallback} />
          {action.startMessage && <Row label="始める言葉" value={action.startMessage} />}
        </div>

        {/* C案 §8 の値札欄。数字は W4 で入れるため、いまは出どころごと空にしておく */}
        <div className="ticket-preview mt-4">
          <p className="!text-base !mb-2">10年後の生活と値札</p>
          <Row label="10年後の生活" value={state.futureLife?.text ?? 'このあとの画面で描きます'} />
          <Row label="初期費用・月額・週の時間" value="このあとの画面で計算します" />
        </div>

        <p className="mt-4 text-sm">
          カレンダー：{registered ? '登録済み（本人確認）' : '未登録'}
        </p>
        {!registered && (
          <p className="mb-4 text-xs text-[var(--muted)]">
            カレンダーに入れて「保存した」を押すと、登録済みになります。
          </p>
        )}

        {action.start === null ? (
          <Link
            href={`/schedule?actionId=${encodeURIComponent(action.id)}`}
            className="primary-link w-full justify-center border-0"
          >
            日時を決める
          </Link>
        ) : (
          calendarMode !== 'off' && (
            <Link
              href={`/calendar/${encodeURIComponent(action.id)}`}
              className="primary-link w-full justify-center border-0"
            >
              カレンダーに入れる
            </Link>
          )
        )}

        <div className="secondary-links">
          {action.start && (
            <Link href={`/schedule?actionId=${encodeURIComponent(action.id)}`}>日時を変える</Link>
          )}
          <Link href="/home">ホームへ</Link>
        </div>
      </section>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <small className="!block">
      <span className="font-semibold">{label}</span>：{value}
    </small>
  );
}
