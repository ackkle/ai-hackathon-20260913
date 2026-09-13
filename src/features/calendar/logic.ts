/**
 * F-16 カレンダー登録 方法B（テンプレートURL + 本人確認）の計算部分。
 * 仕様: mvp-spec 第5章 C群・第14.1節、B案 FR-08・§12.2。
 * カレンダー側で保存したかはアプリから確認できないため、本人が押したときだけ登録済みにする。
 * テストは tests/calendar.test.ts。
 */
import type { Action, HistoryEntry, ReserveState, Wish } from '@/shared/types';

/** 日本時間の固定オフセット（夏時間が無いので固定値で足りる） */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 説明欄の上限。長いとURLが伸びて開けなくなるため（B案 §12.2・Q-04） */
export const DETAILS_MAX = 500;

export const TEMPLATE_ENDPOINT = 'https://calendar.google.com/calendar/render';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** テンプレートURLの `dates` に入れる形式（YYYYMMDDTHHmmss、日本時間の壁時計） */
export function toTemplateStamp(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  return (
    `${jst.getUTCFullYear()}${pad(jst.getUTCMonth() + 1)}${pad(jst.getUTCDate())}` +
    `T${pad(jst.getUTCHours())}${pad(jst.getUTCMinutes())}${pad(jst.getUTCSeconds())}`
  );
}

/** 予定のタイトル。カレンダーの一覧で見分けられるようにする（B案 FR-08） */
export function buildTitle(action: Action): string {
  return `【リザーブマシン】${action.title}`;
}

/**
 * 説明欄。カレンダーだけを見ても動けるように、願い・今回の一歩・準備・
 * 気が重いときは・アプリのURL を入れる（B案 FR-08）。上限で切る。
 */
export function buildDetails(
  action: Action,
  wish: Wish | null,
  appUrl: string,
): string {
  const lines = [
    wish?.text ? `やりたいこと：${wish.text}` : null,
    `今回の一歩：${action.title}`,
    action.place ? `場所：${action.place}` : null,
    `準備：${action.prep.length > 0 ? action.prep.join('、') : '特にありません'}`,
    `気が重いときは：${action.fallback}`,
    action.startMessage ? `始める言葉：${action.startMessage}` : null,
    action.reservationNo ? `予約番号：${action.reservationNo}` : null,
    appUrl ? `リザーブマシン：${appUrl}` : null,
  ].filter((line): line is string => line !== null);
  const text = lines.join('\n');
  return text.length <= DETAILS_MAX ? text : `${text.slice(0, DETAILS_MAX - 1)}…`;
}

/**
 * Googleカレンダーの予定作成画面のURL。日時が決まっていない行動では作れない。
 * 値はURLエンコードする（B案 §12.2）。
 */
export function buildTemplateUrl(
  action: Action,
  wish: Wish | null,
  appUrl: string,
): string | null {
  if (action.start === null || action.end === null) return null;
  const start = toTemplateStamp(action.start);
  const end = toTemplateStamp(action.end);
  if (start === null || end === null) return null;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: buildTitle(action),
    dates: `${start}/${end}`,
    ctz: 'Asia/Tokyo',
    details: buildDetails(action, wish, appUrl),
  });
  return `${TEMPLATE_ENDPOINT}?${params.toString()}`;
}

/**
 * 「カレンダーに保存した」を本人が押したときだけ呼ぶ。
 * status を registered、calendar.method を template、confirmedAt を押した時刻にする。
 * 予定ID・リンクはテンプレートURLでは受け取れないので null のままにする。
 */
export function confirmRegistration(
  state: ReserveState,
  action: Action,
  input: { now: string; historyId: string },
): { state: ReserveState; action: Action } {
  const updated: Action = {
    ...action,
    status: 'registered',
    calendar: { method: 'template', eventId: null, htmlLink: null, confirmedAt: input.now },
  };
  const entry: HistoryEntry = {
    id: input.historyId,
    actionId: action.id,
    change: 'create',
    before: { status: action.status, calendar: action.calendar },
    after: { status: updated.status, calendar: updated.calendar },
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

/** 画面に出す登録状態の文言。実際に確認していない予定を「登録済み」と書かない（第14.1節） */
export function registrationLabel(action: Action): string {
  return action.calendar.confirmedAt !== null ? '登録済み（本人確認）' : '未登録';
}
