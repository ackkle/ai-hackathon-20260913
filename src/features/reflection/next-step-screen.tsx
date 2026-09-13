'use client';
/**
 * S-14 次の一歩（F-22）。AI-04 の結果を1件表示し、本人が「承認」「保留」「別の案」を選ぶ。
 * 承認するまで行動・日時・カレンダーは変えない（mvp-spec 第6.6節、B案 FR-11）。
 * 枠が満杯（3件）のときの置き換え（F-23）は W5。
 */
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getFeatureMode } from '@/config/features';
import { saveState } from '@/shared/storage';
import type { NextStepResponse, ReflectionRecord, ReserveState } from '@/shared/types';
import {
  NEXT_STEP_LABELS,
  applyApproval,
  applyHold,
  createActionFromProposal,
  createProposal,
  ensurePlan,
  findAction,
  isNextBlocked,
  makeId,
  normalizeNextStep,
  type Feeling,
  type ReflectResult,
} from './logic';
import { ModeBanner, ScreenHeading } from './ui';
import { useStoredState } from './use-stored-state';

type Fetched = { step: NextStepResponse; isMock: boolean };
type Attempt = { count: number; avoidTitle: string | null };

export function NextStepScreen({ recordId }: { recordId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const stored = useStoredState();
  const [attempt, setAttempt] = useState<Attempt>({ count: 0, avoidTitle: null });
  const [fetched, setFetched] = useState<Fetched | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sameAsBefore, setSameAsBefore] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const state = stored?.data ?? null;
  const savedRecord = state?.records.find(item => item.id === recordId) ?? null;
  const isSample = state !== null && savedRecord === null;
  // S-13 のサンプル表示から来た場合。保存はしないので、結果だけ引き継いで動きを見せる。
  const record: ReflectionRecord | null =
    savedRecord ??
    (state === null
      ? null
      : {
          id: recordId,
          actionId: recordId,
          result: parseResult(params.get('result')),
          feeling: parseFeeling(params.get('feeling')),
          again: 'no_answer',
          memo: '',
          recordedAt: new Date(0).toISOString(),
        });

  const result = record?.result ?? null;
  const feeling = record?.feeling ?? null;
  const actionId = record?.actionId ?? null;
  const avoidTitle = attempt.avoidTitle;

  useEffect(() => {
    if (state === null || record === null) return;
    let cancelled = false;
    void (async () => {
      const outcome = await requestNextStep(state, record, avoidTitle);
      if (cancelled) return;
      if (outcome.ok) {
        setFetched(outcome.value);
        setSameAsBefore(avoidTitle !== null && avoidTitle === outcome.value.step.title);
        setStatus('ready');
      } else {
        setErrorMessage(outcome.message);
        setStatus('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
    // record は state から導いた値なので、内容が変わる入力だけを見る。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, actionId, result, feeling, attempt.count, avoidTitle]);

  if (stored === null || record === null) {
    return <p className="text-sm text-[var(--muted)]">読み込んでいます…</p>;
  }

  function decide(mode: 'approve' | 'hold') {
    if (!fetched || record === null || state === null) return;
    if (isSample) {
      setNotice('サンプル表示のため、保存はしていません。');
      return;
    }
    const now = new Date().toISOString();
    const proposal = createProposal({ id: makeId('prop'), recordId: record.id, step: fetched.step });
    let next: ReserveState;
    let destination: string;
    if (mode === 'hold') {
      next = applyHold(state, proposal, now);
      destination = '/home';
    } else {
      const withPlan = ensurePlan(state, now);
      const action = createActionFromProposal({
        id: makeId('act'),
        proposal,
        planId: withPlan.planId,
        now,
      });
      next = applyApproval(withPlan.state, proposal, action, now);
      destination = `/schedule?actionId=${action.id}`;
    }
    const saved = saveState(next);
    if (!saved.ok) {
      setNotice(saved.error);
      return;
    }
    router.push(destination);
  }

  function retry() {
    if (!fetched || attempt.count > 0) return;
    setStatus('loading');
    setAttempt({ count: 1, avoidTitle: fetched.step.title });
  }

  const blocked = isNextBlocked(record);

  return (
    <>
      <ModeBanner
        mode={getFeatureMode('F-22')}
        sample={isSample}
        sampleText="サンプル：保存された記録が見つからないため、見本として表示しています。承認しても保存しません。"
        mockText="サンプル：この提案は固定のモック応答です。実際のAIはまだ呼んでいません。"
      />
      <section className="screen-panel">
        <ScreenHeading screenId="S-14" />

        {status === 'loading' && (
          <p className="text-sm text-[var(--muted)]">次の一歩を考えています…</p>
        )}

        {status === 'failed' && (
          <>
            <p className="notice mb-4">{errorMessage}</p>
            <button
              type="button"
              onClick={() => setAttempt(current => ({ ...current, count: current.count + 1 }))}
              className="primary-link w-full justify-center border-0"
            >
              もう一度ためす
            </button>
            <p className="mt-3 text-xs text-[var(--muted)]">
              記録は保存されています。提案が出せなくても、記録は消えません。
            </p>
          </>
        )}

        {status === 'ready' && fetched && (
          <>
            <div className="ticket-preview">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                次の一歩
                <span className="rounded-full bg-[#e7efe6] px-3 py-1 text-[var(--accent)]">
                  {NEXT_STEP_LABELS[fetched.step.type]}
                </span>
              </p>
              <p className="!mb-3 !text-lg">{fetched.step.title}</p>
              <ul className="m-0 mb-4 list-none p-0 text-sm text-[var(--muted)]">
                <li>目安 {fetched.step.durationMin}分</li>
                {fetched.step.prep.length > 0 && <li>持ちもの：{fetched.step.prep.join('、')}</li>}
                <li>うまくいかないとき：{fetched.step.fallback}</li>
              </ul>
              <small>
                この案にした理由：{fetched.step.reason}
                <br />
                {fetched.step.message}
              </small>
            </div>

            {blocked && (
              <p className="mb-4 text-xs text-[var(--muted)]">
                今回は負担を小さくする案だけを出しています。休むことを選んでも大丈夫です。
              </p>
            )}
            {sameAsBefore && (
              <p className="mb-4 text-xs text-[var(--muted)]">
                モック応答のため、別の案でも同じ内容が返っています。
              </p>
            )}
            {notice && <p className="notice mb-4">{notice}</p>}

            <button
              type="button"
              onClick={() => decide('approve')}
              className="primary-link mb-3 w-full justify-center border-0"
            >
              この案で進める
            </button>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => decide('hold')}
                className="min-h-[44px] flex-1 rounded-xl border border-[#d8e1d3] bg-white px-4 text-sm"
              >
                保留にする
              </button>
              <button
                type="button"
                onClick={retry}
                disabled={attempt.count > 0}
                className="min-h-[44px] flex-1 rounded-xl border border-[#d8e1d3] bg-white px-4 text-sm disabled:text-[var(--muted)]"
              >
                別の案を見る{attempt.count > 0 && '（1回まで）'}
              </button>
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">
              承認するまで、予定もカレンダーも変わりません。
            </p>
          </>
        )}

        <div className="secondary-links">
          <Link href="/home">ホームにもどる</Link>
        </div>
      </section>
    </>
  );
}

type Outcome = { ok: true; value: Fetched } | { ok: false; message: string };

async function requestNextStep(
  state: ReserveState,
  record: ReflectionRecord,
  avoidTitle: string | null,
): Promise<Outcome> {
  try {
    const response = await fetch('/api/ai/next-step', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        goal: state.tree?.goals[0]?.text ?? null,
        action: findAction(state, record.actionId),
        record,
        recentRecords: state.records.slice(-5),
        avoidTitle,
      }),
    });
    const body = (await response.json()) as { message?: string; isMock?: boolean; data?: unknown };
    if (!response.ok) {
      return { ok: false, message: body.message ?? '次の一歩を作れませんでした' };
    }
    const step = normalizeNextStep(body.data as NextStepResponse, record);
    return { ok: true, value: { step, isMock: Boolean(body.isMock) } };
  } catch {
    return { ok: false, message: '次の一歩を作れませんでした' };
  }
}

function parseResult(value: string | null): ReflectResult {
  return value === 'done' || value === 'partial' || value === 'not_done' ? value : 'partial';
}

function parseFeeling(value: string | null): Feeling | null {
  return value === 'fun' || value === 'neutral' || value === 'tired' || value === 'no_answer'
    ? value
    : null;
}
