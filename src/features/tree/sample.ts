import type { ReserveState } from '@/shared/types';

/** Explicit opt-in only; sample answers never replace a saved wish or plan. */
export function withSampleAnswers(state: ReserveState, now: string): ReserveState {
  if (state.wish || state.tree || state.plans.length || state.actions.length || state.answers.length || state.records.length || state.proposals.length || state.history.length) {
    throw new Error('入力済みの内容があります。質問画面から続けてください');
  }
  return {
    ...state, isDemo: true, demoPersona: 'tree-sample',
    wish: { id: `wish_${crypto.randomUUID()}`, text: '木工を始めて、作ったものを家族に渡したい', reason: '手を動かす楽しみを見つけたい', category: 'activity', createdAt: now },
    answers: [
      { questionId: 'fixed_slots', text: '使える時間帯', value: ['holiday_morning'], isUnknown: false },
      { questionId: 'fixed_duration', text: '1回に使える時間（分）', value: 30, isUnknown: false },
      { questionId: 'fixed_budget', text: '月に使える予算（円）', value: 10000, isUnknown: false },
      { questionId: 'fixed_experience', text: '経験', value: 'none', isUnknown: false },
    ],
  };
}
