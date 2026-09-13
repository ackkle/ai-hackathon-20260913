'use client';
/**
 * S-09 日時の手入力（F-14 の手入力部分）。
 * 日時候補3つの自動提示は W5（#22 以降）。ここは手入力だけを扱う。
 * 過去の日時は確定させず、他の予定と重なるときは警告を出して本人に決めてもらう（B案 FR-07）。
 */
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { getFeatureMode } from '@/config/features';
import { ModeBanner, ScreenHeading } from '@/features/reflection/ui';
import { useStoredState } from '@/features/reflection/use-stored-state';
import { saveState } from '@/shared/storage';
import {
  DURATION_MAX,
  DURATION_MIN,
  applySchedule,
  checkSchedule,
  findAction,
  firstUnscheduled,
  formatRange,
  makeId,
  toLocalInput,
  toJstIso,
} from './logic';
import { SAMPLE_ACTION_ID, sampleReservation } from './sample';

export function ScheduleScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const stored = useStoredState();
  const [localDateTime, setLocalDateTime] = useState<string | null>(null);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overlapTitle, setOverlapTitle] = useState<string | null>(null);
  const [confirmedOverlap, setConfirmedOverlap] = useState(false);

  if (stored === null) return <p className="text-sm text-[var(--muted)]">読み込んでいます…</p>;

  const state = stored.data;
  const requestedId = params.get('actionId');
  const savedAction = requestedId ? findAction(state, requestedId) : firstUnscheduled(state);
  const isSample = savedAction === null;
  const action = savedAction ?? sampleReservation(requestedId ?? SAMPLE_ACTION_ID);
  const value = localDateTime ?? (action.start ? toLocalInput(action.start) : '');
  const duration = durationMin ?? action.durationMin;
  // 過去の日時を選びにくくする。確定時にも checkSchedule で必ず弾く
  const minInput = toLocalInput(toJstIso(new Date()));

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const now = new Date().toISOString();
    const checked = checkSchedule(state, action.id, { localDateTime: value, durationMin: duration }, now);
    if (!checked.ok) {
      setError(checked.error);
      setOverlapTitle(null);
      return;
    }
    if (checked.overlap !== null && !confirmedOverlap) {
      setError(null);
      setOverlapTitle(checked.overlap.title);
      setConfirmedOverlap(true);
      return;
    }
    if (isSample) {
      // 見本の行動では保存しない。予約票の見本をそのまま見せる
      router.push(`/ticket/${action.id}`);
      return;
    }
    const next = applySchedule(state, action, {
      start: checked.start,
      end: checked.end,
      durationMin: duration,
      now,
      historyId: makeId('hist'),
    });
    const saved = saveState(next.state);
    if (!saved.ok) {
      setError(saved.error);
      return;
    }
    router.push(`/ticket/${next.action.id}`);
  }

  return (
    <>
      <ModeBanner
        mode={getFeatureMode('F-14')}
        sample={isSample}
        sampleText="サンプル：保存された行動が見つからないため、見本の行動で表示しています。この画面では保存しません。"
        mockText="サンプル：日時候補の自動提示はまだ入っていません。手入力で日時を決められます。"
      />
      <section className="screen-panel">
        <ScreenHeading screenId="S-09" />
        {stored.error && <p className="notice mb-4">{stored.error}</p>}

        <div className="ticket-preview">
          <p className="!text-base !mb-2">
            {action.isFirstDay && <span className="ticket-mark">最初の1日</span>}
            {action.title}
          </p>
          <small className="!border-0 !pt-0">
            目安 {action.durationMin}分{action.place && ` ／ ${action.place}`}
          </small>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <label className="mb-6 block">
            <span className="mb-2 block text-sm font-semibold">
              日時<span className="ml-1 text-[var(--accent)]">（必須）</span>
            </span>
            <input
              type="datetime-local"
              value={value}
              min={minInput}
              onChange={event => {
                setLocalDateTime(event.target.value);
                setError(null);
                setOverlapTitle(null);
                setConfirmedOverlap(false);
              }}
              className="min-h-[44px] w-full rounded-xl border border-[#d8e1d3] bg-white p-3 text-sm"
            />
            <span className="mt-1 block text-xs text-[var(--muted)]">日本時間で入力してください。</span>
          </label>

          <label className="mb-6 block">
            <span className="mb-2 block text-sm font-semibold">所要時間（分）</span>
            <input
              type="number"
              value={duration}
              min={DURATION_MIN}
              max={DURATION_MAX}
              step={5}
              inputMode="numeric"
              onChange={event => {
                setDurationMin(Number(event.target.value));
                setError(null);
                setOverlapTitle(null);
                setConfirmedOverlap(false);
              }}
              className="min-h-[44px] w-full rounded-xl border border-[#d8e1d3] bg-white p-3 text-sm"
            />
            <span className="mt-1 block text-xs text-[var(--muted)]">
              {DURATION_MIN}分から{DURATION_MAX}分まで。短くしても大丈夫です。
            </span>
          </label>

          {value !== '' && error === null && (
            <p className="mb-3 text-sm">
              確定する日時：{formatRange(`${value}:00+09:00`, null)} から {duration}分
            </p>
          )}
          {error && <p className="notice mb-3">{error}</p>}
          {overlapTitle && (
            <p className="notice mb-3">
              「{overlapTitle}」と時間が重なっています。このまま進める場合は、もう一度「それでも確定する」を押してください。
            </p>
          )}

          <button type="submit" className="primary-link w-full justify-center border-0">
            {overlapTitle ? 'それでも確定する' : '日時を確定する'}
          </button>
        </form>

        <div className="secondary-links">
          <Link href="/tree">行動を選び直す</Link>
          <Link href="/home">日時は決めずに戻る</Link>
        </div>
      </section>
    </>
  );
}
