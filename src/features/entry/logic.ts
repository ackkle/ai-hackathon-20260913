/**
 * S-02 入口 / S-03 願いの入力 の計算部分（画面から切り離した純粋関数）。
 * 仕様: mvp-spec 第6.2節、B案 FR-01、F-33。テストは tests/entry.test.ts。
 */
import type { ReserveState, Wish } from '@/shared/types';

/** B案 §3：願いは200文字までにそろえる（スキーマには上限が無いため画面側で切る） */
export const WISH_MAX = 200;

export const WISH_EXAMPLES = ['お金持ちになりたい', '何かしたい', '英語を話したい'];

/** F-33：入力前に必ず出す送信の注意書き */
export const SEND_NOTICE =
  '入力した内容は、提案を作るためにAIへ送信されます。記録はこの端末にだけ保存されます。';

export function createWish(input: { id: string; text: string; now: string }): Wish {
  const text = input.text.trim().slice(0, WISH_MAX);
  return { id: input.id, text, reason: null, category: 'unknown', createdAt: input.now };
}

/**
 * 願いは1件だけ持つ。すでに回答や計画がある場合は上書きしない
 * （B案 §1.3・§10.1 と同じ「上書きより前に確認する」方針）。
 */
export function applyWish(state: ReserveState, wish: Wish): ReserveState {
  if (state.wish || state.answers.length > 0 || state.tree) {
    throw new Error('すでに願いが保存されています。新しい願いは設定から始めてください');
  }
  return { ...state, entry: { type: 'wish' }, wish };
}
