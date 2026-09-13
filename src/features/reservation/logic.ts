/**
 * F-14 日時の手入力 / F-15 予約票 の計算部分（画面から切り離した純粋関数）。
 * 仕様: mvp-spec 第6.5節、A案 §5、B案 FR-07・§10.4・§15。
 * 日時はすべて日本時間で扱う（NFR-09）。テストは tests/reservation.test.ts。
 */
import type { Action, HistoryEntry, ReserveState } from '@/shared/types';

/** 所要時間の許容範囲（ActionSchema.durationMin と合わせる） */
export const DURATION_MIN = 5;
export const DURATION_MAX = 240;

/** 日本時間の固定オフセット。夏時間が無いので固定値で足りる */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

/** 予定として場所を取っている状態。重なりの判定に使う（B案 §10.4） */
const OCCUPYING: ReadonlySet<Action['status']> = new Set(['scheduled', 'registered']);

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

/** Date を日本時間の ISO 文字列（+09:00 付き）にする */
export function toJstIso(date: Date): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  return (
    `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}` +
    `T${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}:${pad(jst.getUTCSeconds())}+09:00`
  );
}

/**
 * `<input type="datetime-local">` の値（YYYY-MM-DDTHH:mm）を日本時間として読む。
 * 端末のタイムゾーンに左右されないよう、文字列のまま +09:00 を付ける。
 */
export function fromLocalInput(value: string): string | null {
  const matched = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (matched === null) return null;
  const iso = `${value.trim()}:00+09:00`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

/** ISO 文字列を `<input type="datetime-local">` に戻す（日本時間で表示する） */
export function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return toJstIso(date).slice(0, 16);
}

export function addMinutes(iso: string, minutes: number): string {
  return toJstIso(new Date(new Date(iso).getTime() + minutes * 60_000));
}

/** NFR-09 の表示形式：9月19日（土）10:00〜10:30 */
export function formatRange(start: string, end: string | null): string {
  const from = new Date(start);
  if (Number.isNaN(from.getTime())) return start;
  const jst = new Date(from.getTime() + JST_OFFSET_MS);
  const head =
    `${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日（${WEEKDAYS[jst.getUTCDay()]}）` +
    `${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
  if (end === null) return head;
  const to = new Date(end);
  if (Number.isNaN(to.getTime())) return head;
  const toJst = new Date(to.getTime() + JST_OFFSET_MS);
  return `${head}〜${pad(toJst.getUTCHours())}:${pad(toJst.getUTCMinutes())}`;
}

/** 予約番号の日付部分（日本時間の開始日） */
function dayKey(iso: string): string {
  const jst = new Date(new Date(iso).getTime() + JST_OFFSET_MS);
  return `${jst.getUTCFullYear()}${pad(jst.getUTCMonth() + 1)}${pad(jst.getUTCDate())}`;
}

/**
 * 予約番号 RM-YYYYMMDD-NNN。同じ日に既にある番号の次を使い、重複を避ける（A案 §5）。
 */
export function nextReservationNo(actions: Action[], startIso: string): string {
  const prefix = `RM-${dayKey(startIso)}-`;
  const used = actions.reduce((max, action) => {
    const no = action.reservationNo;
    if (no === null || !no.startsWith(prefix)) return max;
    const serial = Number(no.slice(prefix.length));
    return Number.isInteger(serial) && serial > max ? serial : max;
  }, 0);
  return `${prefix}${pad(used + 1, 3)}`;
}

/** 同じ時間帯に入っている他の行動。重なりは警告するだけで、確定は本人が決める（B案 FR-07） */
export function findOverlap(
  actions: Action[],
  input: { actionId: string; start: string; end: string },
): Action | null {
  const start = new Date(input.start).getTime();
  const end = new Date(input.end).getTime();
  return (
    actions.find(action => {
      if (action.id === input.actionId) return false;
      if (!OCCUPYING.has(action.status)) return false;
      if (action.start === null || action.end === null) return false;
      const otherStart = new Date(action.start).getTime();
      const otherEnd = new Date(action.end).getTime();
      if (Number.isNaN(otherStart) || Number.isNaN(otherEnd)) return false;
      return start < otherEnd && otherStart < end;
    }) ?? null
  );
}

export type ScheduleDraft = { localDateTime: string; durationMin: number };
export type ScheduleCheck =
  | { ok: false; error: string }
  | { ok: true; start: string; end: string; overlap: Action | null };

/**
 * 手入力の検証（B案 §15）。過去の日時は確定させない。重なりはエラーにせず警告として返す。
 */
export function checkSchedule(
  state: ReserveState,
  actionId: string,
  draft: ScheduleDraft,
  now: string,
): ScheduleCheck {
  if (draft.localDateTime.trim() === '') return { ok: false, error: '日時を入力してください' };
  const start = fromLocalInput(draft.localDateTime);
  if (start === null) return { ok: false, error: '日時の形式が正しくありません' };
  if (!Number.isInteger(draft.durationMin) || draft.durationMin < DURATION_MIN || draft.durationMin > DURATION_MAX) {
    return { ok: false, error: `所要時間は${DURATION_MIN}分から${DURATION_MAX}分の間で入力してください` };
  }
  if (new Date(start).getTime() <= new Date(now).getTime()) {
    return { ok: false, error: '過去の日時は選べません' };
  }
  const end = addMinutes(start, draft.durationMin);
  return { ok: true, start, end, overlap: findOverlap(state.actions, { actionId, start, end }) };
}

export function findAction(state: ReserveState, actionId: string): Action | null {
  return state.actions.find(action => action.id === actionId) ?? null;
}

/** 日時がまだ決まっていない行動（S-09 を actionId 無しで開いたときの既定） */
export function firstUnscheduled(state: ReserveState): Action | null {
  return state.actions.find(action => action.status === 'unscheduled') ?? null;
}

/**
 * 日時を確定する。状態は「日時確定（未登録）」にする（B案 §10.4）。
 * ActionSchema が proposed/reserved を unscheduled/scheduled に正規化するため、値は正規化後で書く。
 * 日時を変えたときはカレンダーの登録状態を外す。カレンダー側の予定はアプリから確認できないので、
 * 変更後も「登録済み」と出すと第14.1節に反するため（画面で入れ直しを案内する）。
 */
export function applySchedule(
  state: ReserveState,
  action: Action,
  input: { start: string; end: string; durationMin: number; now: string; historyId: string },
): { state: ReserveState; action: Action } {
  const isReschedule = action.start !== null && action.start !== input.start;
  const cleared = isReschedule && action.calendar.confirmedAt !== null;
  const updated: Action = {
    ...action,
    durationMin: input.durationMin,
    start: input.start,
    end: input.end,
    status: 'scheduled',
    reservationNo: action.reservationNo ?? nextReservationNo(state.actions, input.start),
    calendar: cleared
      ? { method: null, eventId: null, htmlLink: null, confirmedAt: null }
      : action.calendar,
  };
  const entry: HistoryEntry = {
    id: input.historyId,
    actionId: action.id,
    change: isReschedule ? 'reschedule' : 'create',
    before: { start: action.start, end: action.end, status: action.status },
    after: { start: updated.start, end: updated.end, status: updated.status },
    at: input.now,
  };
  return {
    state: {
      ...state,
      actions: state.actions.map(item => (item.id === updated.id ? updated : item)),
      history: [...state.history, entry],
    },
    action: updated,
  };
}

export function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
