import { describe, expect, it } from 'vitest';
import mockQuestions from '../mocks/ai/questions.json';
import {
  QuestionsEnvelopeSchema,
  applyAnswers,
  initDraft,
  isDraftComplete,
  toAnswers,
} from '../src/features/questions/logic';
import { createEmptyState } from '../src/shared/types';

const now = '2026-09-13T05:00:00.000Z';
const questions = QuestionsEnvelopeSchema.parse({ task: 'questions', isMock: true, data: mockQuestions }).data
  .questions;

function baseState() {
  const state = createEmptyState();
  state.wish = { id: 'wish_1', text: 'なんか、このままじゃまずい気がする', reason: null, category: 'unknown', createdAt: now };
  return state;
}

describe('S-06 質問画面', () => {
  it('mocks/ai/questions.json を実際の応答スキーマで読める', () => {
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.length).toBeLessThanOrEqual(5);
  });

  it('初期状態はどの質問も未回答', () => {
    const draft = initDraft(questions);
    expect(isDraftComplete(questions, draft)).toBe(false);
    expect(Object.keys(draft)).toHaveLength(questions.length);
  });

  it('すべて「分からない」にすると次へ進める', () => {
    const draft = initDraft(questions);
    for (const question of questions) draft[question.id] = { value: null, isUnknown: true };
    expect(isDraftComplete(questions, draft)).toBe(true);
    const answers = toAnswers(questions, draft);
    expect(answers.every(answer => answer.isUnknown && answer.value === null)).toBe(true);
    expect(answers.map(answer => answer.questionId)).toEqual(questions.map(question => question.id));
  });

  it('選択式・複数選択・数値のそれぞれで回答があれば完了になる', () => {
    const draft = initDraft(questions);
    for (const question of questions) {
      if (question.type === 'multi') draft[question.id] = { value: [question.options?.[0] ?? '選択肢'], isUnknown: false };
      else if (question.type === 'number') draft[question.id] = { value: 3, isUnknown: false };
      else draft[question.id] = { value: question.options?.[0] ?? '選択肢', isUnknown: false };
    }
    expect(isDraftComplete(questions, draft)).toBe(true);
    const answers = toAnswers(questions, draft);
    expect(answers.some(answer => Array.isArray(answer.value))).toBe(true);
    expect(answers.some(answer => typeof answer.value === 'number')).toBe(true);
  });

  it('1問でも未回答なら完了にならない', () => {
    const draft = initDraft(questions);
    draft[questions[0].id] = { value: null, isUnknown: true };
    expect(isDraftComplete(questions, draft)).toBe(false);
  });

  it('願いが無ければ保存できない', () => {
    const state = createEmptyState();
    expect(() => applyAnswers(state, toAnswers(questions, initDraft(questions)))).toThrow();
  });

  it('願いがあれば既存の answers 形式のまま保存できる', () => {
    const state = baseState();
    const draft = initDraft(questions);
    draft[questions[0].id] = { value: '休日の午前', isUnknown: false };
    for (let i = 1; i < questions.length; i += 1) draft[questions[i].id] = { value: null, isUnknown: true };
    const answers = toAnswers(questions, draft);
    const result = applyAnswers(state, answers);
    expect(result.answers).toEqual(answers);
    expect(result.answers[0]).toMatchObject({ questionId: questions[0].id, value: '休日の午前', isUnknown: false });
    expect(result.wish).toEqual(state.wish);
  });

  it('すでに道筋があれば答え直しを保存しない', () => {
    const state = baseState();
    state.tree = { goals: [], metrics: [], monthly: [] };
    expect(() => applyAnswers(state, toAnswers(questions, initDraft(questions)))).toThrow();
  });

  it('/tree が要求する answers.length > 0 を満たす', () => {
    const state = baseState();
    const draft = initDraft(questions);
    for (const question of questions) draft[question.id] = { value: null, isUnknown: true };
    const result = applyAnswers(state, toAnswers(questions, draft));
    expect(result.wish).not.toBeNull();
    expect(result.answers.length).toBeGreaterThan(0);
  });
});
