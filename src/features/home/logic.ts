/**
 * F-20 ホーム（S-12）の計算部分（画面から切り離した純粋関数）。
 * 仕様: mvp-spec 第5章 D群、A案 ②③、B案 FR-09・S-06。
 * 日時はすべて日本時間で扱う（NFR-09）。テストは tests/home.test.ts。
 *
 * 守ること（mvp-spec 第14.1節）
 * - 実際に登録を確認していない行動を「登録済み」と表示しない（calendar.confirmedAt を見る）。
 * - 終了時刻を過ぎた行動を自動で「できなかった」にしない。「確認待ち」として本人に尋ねる。
 * - 行動の件数を達成率・点数に換算しない。
 */
import type { Action, ReflectionRecord, ReserveState } from '@/shared/types';

/** 今週の予定に出す上限。行動枠の最大3件に合わせる（A案 ③） */
export const WEEKLY_LIMIT = 3;
/** 楽しかった体験・またやりたいことに出す上限 */
export const ENJOYED_LIMIT = 3;

/** まだ結果を記録していない状態（予定として生きている行動） */
const OPEN_STATUS: ReadonlySet<Action['status']> = new Set(['unscheduled', 'scheduled', 'registered']);

export type StatusLabel =
  | '日時未設定'
  | 'カレンダー未登録'
  | '登録済み'
  | '確認待ち'
  | 'できた'
  | '少しできた'
  | 'できなかった'
  | '見送り';

function time(iso: string | null): number | null {
  if (iso === null) return null;
  const value = new Date(iso).getTime();
  return Number.isNaN(value) ? null : value;
}

export function findRecord(records: ReflectionRecord[], actionId: string): ReflectionRecord | null {
  return records.find(record => record.actionId === actionId) ?? null;
}

/**
 * 終了時刻を過ぎていて、まだ結果が無い行動。
 * 自動で「できなかった」にはせず、本人に S-13 で尋ねる（B案 FR-09）。
 */
export function isAwaitingReview(action: Action, records: ReflectionRecord[], now: Date): boolean {
  if (!OPEN_STATUS.has(action.status)) return false;
  const end = time(action.end);
  if (end === null) return false;
  return end <= now.getTime() && findRecord(records, action.id) === null;
}

/** B案 S-06 の状態表示。カレンダーの確認が取れていない行動は「登録済み」と書かない */
export function statusLabel(action: Action, records: ReflectionRecord[], now: Date): StatusLabel {
  switch (action.status) {
    case 'done': return 'できた';
    case 'partial': return '少しできた';
    case 'not_done': return 'できなかった';
    case 'skipped': return '見送り';
    default: break;
  }
  if (isAwaitingReview(action, records, now)) return '確認待ち';
  if (action.start === null) return '日時未設定';
  if (action.status === 'registered' && action.calendar.confirmedAt !== null) return '登録済み';
  return 'カレンダー未登録';
}

/** 今の計画の行動。計画がまだ無いときは全部を見る（起動直後やサンプル表示のため） */
export function planActions(state: ReserveState): Action[] {
  const open = state.plans.find(plan => plan.closedAt === null);
  if (open === undefined) return state.actions;
  const ids = new Set(open.actionIds);
  return state.actions.filter(action => ids.has(action.id));
}

/** 開始日時の順。日時未設定は下にまとめる（A案 ②、B案 FR-09） */
export function byStart(actions: Action[]): Action[] {
  return [...actions].sort((left, right) => {
    const a = time(left.start);
    const b = time(right.start);
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  });
}

/**
 * 次の楽しみ：開始時刻が最も近い、これからの行動。
 * 終了時刻を過ぎたものは「確認待ち」に回すので、ここには出さない。
 */
export function nextPleasure(state: ReserveState, now: Date): Action | null {
  const upcoming = state.actions.filter(action => {
    if (!OPEN_STATUS.has(action.status)) return false;
    const end = time(action.end) ?? time(action.start);
    return end !== null && end > now.getTime();
  });
  return byStart(upcoming)[0] ?? null;
}

/** 今週の予定（最大3件、状態つき）。次の楽しみも含めて、計画の全体が見えるようにする */
export function weeklyActions(state: ReserveState, limit: number = WEEKLY_LIMIT): Action[] {
  return byStart(planActions(state)).slice(0, limit);
}

/** 確認待ちの行動。古いものから尋ねる */
export function awaitingActions(state: ReserveState, now: Date): Action[] {
  return byStart(state.actions.filter(action => isAwaitingReview(action, state.records, now)));
}

export type Enjoyed = { record: ReflectionRecord; action: Action | null; title: string };

/**
 * 楽しかった体験・またやりたいこと（A案 ③）。本人が記録したものだけを出し、AIの推測は混ぜない。
 */
export function enjoyed(state: ReserveState, limit: number = ENJOYED_LIMIT): Enjoyed[] {
  return state.records
    .filter(record => record.feeling === 'fun' || record.again === 'again')
    .sort((left, right) => (time(right.recordedAt) ?? 0) - (time(left.recordedAt) ?? 0))
    .slice(0, limit)
    .map(record => {
      const action = state.actions.find(item => item.id === record.actionId) ?? null;
      return { record, action, title: action?.title ?? '記録した行動' };
    });
}

/** 10年後の生活の1行。長い文章のときは最初の1文だけを出す */
export function futureLifeLine(state: ReserveState): string | null {
  const text = state.futureLife?.text.trim();
  if (text === undefined || text === '') return null;
  const [first] = text.split(/[\n。]/).filter(part => part.trim() !== '');
  return first === undefined ? text : `${first}。`.replace(/。。$/, '。');
}

/** 保存済みのデータがあるか。起動時にホームを開くかの判断に使う（#5 と共用） */
export function hasSavedData(state: ReserveState): boolean {
  return (
    state.actions.length > 0 ||
    state.records.length > 0 ||
    state.wish !== null ||
    state.tree !== null ||
    state.futureLife !== null
  );
}
