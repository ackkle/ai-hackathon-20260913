import { describe, expect, it } from 'vitest';
import { WISH_MAX, applyWish, createWish } from '../src/features/entry/logic';
import { createEmptyState } from '../src/shared/types';

const now = '2026-09-13T05:00:00.000Z';

describe('S-03 願いの入力', () => {
  it('前後の空白を落とし、200文字までに切る', () => {
    const wish = createWish({ id: 'wish_1', text: `  ${'あ'.repeat(WISH_MAX + 20)}  `, now });
    expect(wish.text).toHaveLength(WISH_MAX);
    expect(wish.reason).toBeNull();
    expect(wish.category).toBe('unknown');
    expect(wish.createdAt).toBe(now);
  });

  it('願いが無ければ保存できる', () => {
    const state = createEmptyState();
    const wish = createWish({ id: 'wish_1', text: 'お金持ちになりたい', now });
    const result = applyWish(state, wish);
    expect(result.wish).toEqual(wish);
    expect(result.entry).toEqual({ type: 'wish' });
  });

  it('願いだけの段階なら書き直せる', () => {
    const state = createEmptyState();
    const first = applyWish(state, createWish({ id: 'wish_1', text: '何かしたい', now }));
    const rewritten = applyWish(first, createWish({ id: 'wish_2', text: '英語を話したい', now }));
    expect(rewritten.wish?.text).toBe('英語を話したい');
  });

  it('道のりができていれば上書きしない', () => {
    const state = createEmptyState();
    const first = applyWish(state, createWish({ id: 'wish_1', text: '何かしたい', now }));
    const built = { ...first, tree: { goals: [], metrics: [], monthly: [] } };
    expect(() => applyWish(built, createWish({ id: 'wish_2', text: '英語を話したい', now }))).toThrow();
  });

  it('回答や道筋がすでにあれば上書きしない', () => {
    const state = createEmptyState();
    state.answers = [{ questionId: 'fixed_slots', value: ['holiday_morning'], isUnknown: false }];
    expect(() => applyWish(state, createWish({ id: 'wish_1', text: '何かしたい', now }))).toThrow();
  });
});
