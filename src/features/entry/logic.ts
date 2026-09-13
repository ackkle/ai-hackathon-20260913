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
 * 願いはまだ何も積み上がっていないうちは書き直せる。
 * 守りたいのは「積み上げた回答や道のりを黙って捨てないこと」であって、
 * 書き間違いの直しまで止める必要はない（以前は wish があるだけで拒んでいて、
 * 誤字を直すのに記録の全削除しか道が無かった）。
 * 回答・道のり・行動のどれかがあるときは、これまでどおり設定から始め直す。
 */
export function canRewriteWish(state: ReserveState): boolean {
  return state.answers.length === 0 && !state.tree && state.actions.length === 0;
}

export function applyWish(state: ReserveState, wish: Wish): ReserveState {
  if (!canRewriteWish(state)) {
    throw new Error('すでに回答や道のりがあります。新しい願いは設定から始めてください');
  }
  return { ...state, entry: { type: 'wish' }, wish };
}
