/**
 * S-06 質問画面（F-06）の計算部分（画面から切り離した純粋関数）。
 * 仕様: mvp-spec 第6.2節、B案 FR-02。テストは tests/questions.test.ts。
 * AI-01 の応答（QuestionsResponse）を、保存できる Answer[] に変換する。
 * 保存形式は shared/types の AnswerSchema のまま変えない。
 */
import { z } from 'zod';
import { QuestionsResponseSchema, type Answer, type Question, type ReserveState } from '@/shared/types';

export const QuestionsEnvelopeSchema = z.object({
  task: z.literal('questions'),
  isMock: z.boolean(),
  data: QuestionsResponseSchema,
});

export type DraftValue = string | string[] | number | null;
export type DraftEntry = { value: DraftValue; isUnknown: boolean };
export type Draft = Record<string, DraftEntry>;

export function initDraft(questions: Question[]): Draft {
  const draft: Draft = {};
  for (const question of questions) {
    draft[question.id] = { value: question.type === 'multi' ? [] : null, isUnknown: false };
  }
  return draft;
}

function hasAnswer(question: Question, entry: DraftEntry | undefined): boolean {
  if (!entry) return false;
  if (entry.isUnknown) return true;
  if (question.type === 'multi') return Array.isArray(entry.value) && entry.value.length > 0;
  if (question.type === 'number') return typeof entry.value === 'number' && Number.isFinite(entry.value);
  return typeof entry.value === 'string' && entry.value.length > 0;
}

/** 「分からない」を選ぶか、何か答えるまで次へ進めない（B案 FR-02） */
export function isDraftComplete(questions: Question[], draft: Draft): boolean {
  return questions.every(question => hasAnswer(question, draft[question.id]));
}

export function toAnswers(questions: Question[], draft: Draft): Answer[] {
  return questions.map(question => {
    const entry = draft[question.id];
    const unknown = entry?.isUnknown ?? true;
    return {
      questionId: question.id,
      text: question.text,
      value: unknown ? null : (entry?.value ?? null),
      isUnknown: unknown,
    };
  });
}

/**
 * 願いが先にあることを前提にする（B案 FR-02）。すでに道筋を作った後は
 * 答えを差し替えない（tree/logic.ts の「保存済みの計画があります」と同じ方針）。
 */
export function applyAnswers(state: ReserveState, answers: Answer[]): ReserveState {
  if (!state.wish) throw new Error('先に願いを書いてください');
  if (state.tree || state.plans.length > 0 || state.actions.length > 0) {
    throw new Error('すでに道筋があります。ホームから続きを開いてください');
  }
  return { ...state, answers };
}
