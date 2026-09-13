'use client';
/**
 * S-11 カレンダー登録 方法B（F-16）。
 * テンプレートURLを新しいタブで開き、本人が「カレンダーに保存した」を押したときだけ登録済みにする。
 * カレンダー側の保存はアプリから確認できないため、押すまでは「未登録」と表示し続ける（第14.1節、B案 FR-08）。
 * 方法C（.ics）と方法A（API登録）は W6。ここには枠も置かない。
 */
import Link from 'next/link';
import { useState } from 'react';
import { getFeatureMode } from '@/config/features';
import { ModeBanner, ScreenHeading } from '@/features/reflection/ui';
import { useStoredState } from '@/features/reflection/use-stored-state';
import { findAction, formatRange, makeId } from '@/features/reservation/logic';
import { SAMPLE_ACTION_ID, sampleReservation } from '@/features/reservation/sample';
import { saveState } from '@/shared/storage';
import { buildTemplateUrl, buildTitle, confirmRegistration, registrationLabel } from './logic';

export function CalendarScreen({ actionId }: { actionId: string }) {
  const stored = useStoredState();
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mode = getFeatureMode('F-16');

  if (mode === 'off') {
    return (
      <section className="screen-panel">
        <ScreenHeading screenId="S-11" />
        <p className="text-sm">いまはカレンダー登録を使えません。予約票の日時を見ながら進めてください。</p>
        <div className="secondary-links">
          <Link href={`/ticket/${encodeURIComponent(actionId)}`}>予約票に戻る</Link>
          <Link href="/home">ホームへ</Link>
        </div>
      </section>
    );
  }

  if (stored === null) return <p className="text-sm text-[var(--muted)]">読み込んでいます…</p>;

  const state = stored.data;
  const savedAction = findAction(state, actionId);
  const isSample = savedAction === null;
  const action = savedAction ?? sampleReservation(actionId || SAMPLE_ACTION_ID);
  const wish = isSample ? null : state.wish;
  // 保存済みの確認日時があればそれを使う。押した直後は state 更新前でも反映したいので confirmedAt を見る
  const shown = confirmedAt
    ? { ...action, calendar: { ...action.calendar, confirmedAt } }
    : action;
  const registered = shown.calendar.confirmedAt !== null;
  const appUrl = typeof window === 'undefined' ? '' : window.location.origin;
  const templateUrl = buildTemplateUrl(action, wish, appUrl);

  function handleConfirm() {
    const now = new Date().toISOString();
    if (isSample) {
      // 見本の行動は保存しない。保存していないものを「登録済み」と残さない
      setError('サンプルの行動のため、この端末には保存しません。');
      return;
    }
    const next = confirmRegistration(state, action, { now, historyId: makeId('hist') });
    const saved = saveState(next.state);
    if (!saved.ok) {
      setError(saved.error);
      return;
    }
    setError(null);
    setConfirmedAt(now);
  }

  return (
    <>
      <ModeBanner
        mode={mode}
        sample={isSample}
        sampleText="サンプル：保存された行動が見つからないため、見本の行動で表示しています。この画面では保存しません。"
        mockText="いまはテンプレートURL（方法B）だけ使えます。予定ファイルとAPI登録はこのあと追加します。"
      />
      <section className="screen-panel">
        <ScreenHeading screenId="S-11" />
        {stored.error && <p className="notice mb-4">{stored.error}</p>}

        <div className="ticket-preview">
          <p className="!text-base !mb-2">{buildTitle(action)}</p>
          <small className="!border-0 !pt-0">
            {action.start ? formatRange(action.start, action.end) : '日時はまだ決まっていません'}
            {action.place && ` ／ ${action.place}`}
          </small>
        </div>

        <p className="mb-1 text-sm">カレンダー：{registrationLabel(shown)}</p>
        <p className="mb-4 text-xs text-[var(--muted)]">
          {registered
            ? 'あなたが「保存した」と答えた記録です。カレンダー側の予定はアプリからは確認していません。'
            : 'カレンダーに保存できたかはアプリからは分かりません。保存できたら下のボタンを押してください。'}
        </p>

        {templateUrl === null ? (
          <Link
            href={`/schedule?actionId=${encodeURIComponent(action.id)}`}
            className="primary-link w-full justify-center border-0"
          >
            先に日時を決める
          </Link>
        ) : (
          <>
            <a
              href={templateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="primary-link w-full justify-center border-0"
            >
              カレンダーを開く（新しいタブ）
            </a>
            <p className="mt-2 mb-4 text-xs text-[var(--muted)]">
              Googleカレンダーの予定作成画面が開きます。内容を確かめて保存してください。
            </p>
            {!registered && (
              <button
                type="button"
                onClick={handleConfirm}
                className="min-h-[54px] w-full rounded-xl border border-[var(--accent)] bg-white px-4 text-sm font-semibold text-[var(--accent)]"
              >
                カレンダーに保存した
              </button>
            )}
          </>
        )}

        {error && <p className="notice mt-3">{error}</p>}
        {registered && (
          <p className="mt-3 text-sm">
            予約番号 {action.reservationNo ?? '未発番'} の予定を登録済みにしました。
          </p>
        )}

        <div className="secondary-links">
          <Link href={`/ticket/${encodeURIComponent(action.id)}`}>予約票に戻る</Link>
          <Link href="/home">{registered ? 'ホームへ' : 'あとで登録する'}</Link>
        </div>
      </section>
    </>
  );
}
