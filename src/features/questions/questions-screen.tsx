'use client';
/**
 * S-06 質問画面（F-06、AI-01）。
 * AIが作る質問（最大5問）に答える。各問「分からない」を選べる（B案 FR-02）。
 * 保存は既存の answers 形式のまま。保存後は /future（S-07）へ進む。
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { getFeatureMode } from '@/config/features';
import { ModeBanner, ScreenHeading } from '@/features/reflection/ui';
import { useStoredState } from '@/features/reflection/use-stored-state';
import { saveState } from '@/shared/storage';
import type { Question, QuestionsResponse } from '@/shared/types';
import {
  QuestionsEnvelopeSchema,
  applyAnswers,
  initDraft,
  isDraftComplete,
  toAnswers,
  type Draft,
} from './logic';

function QuestionField({
  question,
  entry,
  onChange,
}: {
  question: Question;
  entry: Draft[string];
  onChange: (patch: Partial<Draft[string]>) => void;
}) {
  const unknownLabel = question.allowUnknown === false ? null : '分からない';

  return (
    <fieldset className="mb-6 border-0 p-0 m-0" disabled={entry.isUnknown && false}>
      <legend className="text-sm font-semibold mb-1">{question.text}</legend>
      {question.purpose && <p className="mb-2 text-xs text-[var(--muted)]">{question.purpose}</p>}
      <div className="flex flex-wrap gap-2">
        {question.type === 'single' &&
          (question.options ?? []).map(option => {
            const selected = !entry.isUnknown && entry.value === option;
            return (
              <label
                key={option}
                className={`min-h-[44px] cursor-pointer rounded-full border px-4 py-2 text-sm flex items-center ${selected ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[#d8e1d3] bg-white text-[var(--ink)]'}`}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={selected}
                  onChange={() => onChange({ value: option, isUnknown: false })}
                  className="sr-only"
                />
                {option}
              </label>
            );
          })}

        {question.type === 'multi' &&
          (question.options ?? []).map(option => {
            const values = Array.isArray(entry.value) ? entry.value : [];
            const selected = !entry.isUnknown && values.includes(option);
            return (
              <label
                key={option}
                className={`min-h-[44px] cursor-pointer rounded-full border px-4 py-2 text-sm flex items-center ${selected ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[#d8e1d3] bg-white text-[var(--ink)]'}`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => {
                    const next = selected ? values.filter(item => item !== option) : [...values, option];
                    onChange({ value: next, isUnknown: false });
                  }}
                  className="sr-only"
                />
                {option}
              </label>
            );
          })}

        {question.type === 'number' && (
          <label className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={!entry.isUnknown && typeof entry.value === 'number' ? entry.value : ''}
              onChange={event => {
                const raw = event.target.value;
                onChange({ value: raw === '' ? null : Number(raw), isUnknown: raw === '' });
              }}
              className="w-28 rounded-xl border border-[#d8e1d3] bg-white p-2 text-base"
            />
            {question.unit && <span className="text-sm text-[var(--muted)]">{question.unit}</span>}
          </label>
        )}
      </div>

      {unknownLabel && (
        <button
          type="button"
          onClick={() => onChange({ isUnknown: !entry.isUnknown, value: question.type === 'multi' ? [] : null })}
          className={`mt-2 min-h-[44px] rounded-full border px-4 py-2 text-sm ${entry.isUnknown ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[#d8e1d3] bg-white text-[var(--ink)]'}`}
        >
          {unknownLabel}
        </button>
      )}
    </fieldset>
  );
}

export function QuestionsScreen() {
  const router = useRouter();
  const stored = useStoredState();
  const [response, setResponse] = useState<QuestionsResponse | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const pending = useRef(false);

  const state = stored?.data ?? null;
  const alreadyBuilt = Boolean(state && (state.tree || state.plans.length > 0 || state.actions.length > 0));
  const savedAnswers = state?.answers ?? [];
  const canRequest = Boolean(state?.wish) && !alreadyBuilt;

  async function requestQuestions() {
    if (pending.current || !state) return;
    pending.current = true; setBusy(true); setError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const raw = await fetch('/api/ai/questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ wish: state.wish?.text ?? null }),
      });
      if (!raw.ok) throw new Error('質問を作れませんでした。もう一度お試しください');
      const envelope = QuestionsEnvelopeSchema.parse(await raw.json());
      setResponse(envelope.data);
      setDraft(initDraft(envelope.data.questions));
    } catch (cause) {
      setError(
        cause instanceof Error && cause.name === 'AbortError'
          ? '時間がかかっています。もう一度お試しください'
          : '質問を作れませんでした。もう一度お試しください',
      );
    } finally {
      clearTimeout(timeout); pending.current = false; setBusy(false);
    }
  }

  if (stored === null || state === null) return <p className="text-sm text-[var(--muted)]">読み込んでいます…</p>;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!response || !isDraftComplete(response.questions, draft)) return;
    const answers = toAnswers(response.questions, draft);
    try {
      const saved = saveState(applyAnswers(state!, answers));
      if (!saved.ok) { setSaveError(saved.error); return; }
      window.dispatchEvent(new Event('storage'));
      router.push('/future');
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'この端末に保存できませんでした');
    }
  }

  const mode = getFeatureMode('F-06');

  return (
    <>
      <ModeBanner mode={mode} mockText="サンプル：質問はAIのモック応答です。回答はこの端末に保存されます。" />
      <section className="screen-panel">
        <ScreenHeading screenId="S-06" />
        {stored.error && <p className="notice mb-4">{stored.error}</p>}

        {!state.wish ? (
          <p className="notice mb-4">先に願いを書いてください。<Link href="/wish" className="underline">願いを書く</Link></p>
        ) : alreadyBuilt ? (
          <p className="notice mb-4">すでに道筋があります。<Link href="/home" className="underline">ホームで続きを見る</Link></p>
        ) : busy ? (
          <p role="status" className="text-sm text-[var(--muted)]">質問を考えています…</p>
        ) : error ? (
          <div className="notice mb-4">
            <p className="mb-2">{error}</p>
            <button type="button" onClick={() => void requestQuestions()} className="underline text-sm">もう一度試す</button>
          </div>
        ) : !response && savedAnswers.length > 0 ? (
          <div className="ticket-preview">
            <p className="!text-base !mb-2">回答は保存済みです。</p>
            <small className="!border-0 !pt-0">答え直す場合は「質問を作る」から、もう一度質問を作れます。</small>
          </div>
        ) : !response ? (
          <button type="button" onClick={() => void requestQuestions()} disabled={!canRequest} className="primary-link w-full justify-center border-0">
            質問を作る
          </button>
        ) : response ? (
          response.distress ? (
            <p className="notice mb-4">書いてくれてありがとうございます。<Link href="/support" className="underline">相談できる場所を見る</Link></p>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <p className="mb-4 text-sm text-[var(--muted)]">{response.wishSummary}</p>
              {response.questions.map(question => (
                <QuestionField
                  key={question.id}
                  question={question}
                  entry={draft[question.id] ?? { value: question.type === 'multi' ? [] : null, isUnknown: false }}
                  onChange={patch => setDraft(current => ({ ...current, [question.id]: { ...current[question.id], ...patch } }))}
                />
              ))}
              {!isDraftComplete(response.questions, draft) && (
                <p className="mb-3 text-xs text-[var(--muted)]">すべての質問に答えるか「分からない」を選ぶと、次へ進めます。</p>
              )}
              {saveError && <p className="notice mb-3">{saveError}</p>}
              <button
                type="submit"
                disabled={!isDraftComplete(response.questions, draft)}
                className="primary-link w-full justify-center border-0 disabled:cursor-not-allowed disabled:bg-[#b7c3bb]"
              >
                回答を保存する
              </button>
            </form>
          )
        ) : null}

        {savedAnswers.length > 0 && !alreadyBuilt && !response && !busy && (
          <div className="flex flex-col gap-3">
            <button type="button" onClick={() => void requestQuestions()} className="primary-link w-full justify-center border-0">
              答え直す
            </button>
            <Link href="/future" className="secondary-links"><span>次へ</span></Link>
          </div>
        )}

        <div className="secondary-links">
          <Link href="/wish">願いを書き直す</Link>
        </div>
      </section>
    </>
  );
}
