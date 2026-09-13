'use client';
/**
 * S-13 振り返り（F-21）。結果は必須、気持ち・またやりたいか・ひとことは任意。
 * 記録を先に保存してから S-14 へ進む（B案 FR-10：AIが失敗しても記録は残る）。
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getFeatureMode } from '@/config/features';
import { saveState } from '@/shared/storage';
import type { ReflectionRecord } from '@/shared/types';
import {
  AGAIN_OPTIONS,
  FEELING_OPTIONS,
  MEMO_MAX,
  RESULT_OPTIONS,
  applyRecord,
  createRecord,
  findAction,
  findRecordByAction,
  makeId,
  type Again,
  type Feeling,
  type ReflectResult,
} from './logic';
import { sampleAction } from './sample';
import { ChoiceGroup, ModeBanner, ScreenHeading } from './ui';
import { useStoredState } from './use-stored-state';

type Form = { result: ReflectResult | null; feeling: Feeling | null; again: Again; memo: string };

const EMPTY_FORM: Form = { result: null, feeling: null, again: 'no_answer', memo: '' };

function formFrom(previous: ReflectionRecord | null): Form {
  if (previous === null) return EMPTY_FORM;
  return {
    result: previous.result,
    feeling: previous.feeling,
    again: previous.again,
    memo: previous.memo,
  };
}

export function ReflectScreen({ actionId }: { actionId: string }) {
  const router = useRouter();
  const stored = useStoredState();
  // 入力が始まるまでは、保存済みの記録（記録を直す場合）をそのまま見せる。
  const [edited, setEdited] = useState<Form | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (stored === null) return <p className="text-sm text-[var(--muted)]">読み込んでいます…</p>;

  const state = stored.data;
  const savedAction = findAction(state, actionId);
  const isSample = savedAction === null;
  const action = savedAction ?? sampleAction(actionId);
  const previous = savedAction ? findRecordByAction(state, savedAction.id) : null;
  const form = edited ?? formFrom(previous);
  const update = (patch: Partial<Form>) => setEdited({ ...form, ...patch });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (form.result === null) return;
    if (isSample) {
      // 見本の行動では保存しない。結果だけ S-14 に渡して動きを見せる。
      const query = new URLSearchParams({ result: form.result, sample: '1' });
      if (form.feeling) query.set('feeling', form.feeling);
      router.push(`/next-step/${actionId}?${query.toString()}`);
      return;
    }
    const record = createRecord({
      id: previous?.id ?? makeId('rec'),
      actionId: action.id,
      result: form.result,
      feeling: form.feeling,
      again: form.again,
      memo: form.memo,
      now: new Date().toISOString(),
    });
    const saved = saveState(applyRecord(state, record, makeId('hist')));
    if (!saved.ok) {
      setSaveError(saved.error);
      return;
    }
    router.push(`/next-step/${record.id}`);
  }

  return (
    <>
      <ModeBanner
        mode={getFeatureMode('F-21')}
        sample={isSample}
        sampleText="サンプル：保存された行動が見つからないため、見本の行動で表示しています。この画面では保存しません。"
        mockText="サンプル：記録はこの端末に保存されます。AIの提案は次の画面でモックを使います。"
      />
      <section className="screen-panel">
        <ScreenHeading screenId="S-13" />
        {stored.error && <p className="notice mb-4">{stored.error}</p>}

        <div className="ticket-preview">
          <p className="!text-base !mb-2">{action.title}</p>
          <small className="!border-0 !pt-0">
            {action.start ? formatDateTime(action.start) : '日時の記録なし'} ／ {action.durationMin}分
            {action.place && ` ／ ${action.place}`}
          </small>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <ChoiceGroup
            legend="やってみた結果"
            required
            name="result"
            options={RESULT_OPTIONS}
            value={form.result}
            onChange={value => update({ result: value })}
          />
          <ChoiceGroup
            legend="そのときの気持ち（任意）"
            name="feeling"
            options={FEELING_OPTIONS}
            value={form.feeling}
            onChange={value => update({ feeling: value })}
          />
          <ChoiceGroup
            legend="またやりたいですか（任意）"
            name="again"
            options={AGAIN_OPTIONS}
            value={form.again}
            onChange={value => update({ again: value })}
          />

          <label className="mb-6 block">
            <span className="mb-2 block text-sm font-semibold">ひとこと（任意）</span>
            <textarea
              value={form.memo}
              onChange={event => update({ memo: event.target.value.slice(0, MEMO_MAX) })}
              maxLength={MEMO_MAX}
              rows={3}
              className="w-full rounded-xl border border-[#d8e1d3] bg-white p-3 text-sm"
              placeholder="気づいたことがあれば"
            />
            <span className="block text-right text-xs text-[var(--muted)]">
              {form.memo.length} / {MEMO_MAX}
            </span>
          </label>

          {form.result === null && (
            <p className="mb-3 text-xs text-[var(--muted)]">結果を選ぶと記録できます。</p>
          )}
          {saveError && <p className="notice mb-3">{saveError}</p>}

          <button
            type="submit"
            disabled={form.result === null}
            className="primary-link w-full justify-center border-0 disabled:cursor-not-allowed disabled:bg-[#b7c3bb]"
          >
            記録する
          </button>
        </form>

        <div className="secondary-links">
          <Link href="/home">あとで記録する</Link>
        </div>
      </section>
    </>
  );
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
