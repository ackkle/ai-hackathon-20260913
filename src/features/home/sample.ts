/**
 * デモデータ（#4）が入る前に、S-12 の表示を確かめるための見本。
 * `/home?sample=awaiting` のように開くと使う。保存はしない。画面には「サンプル」と出し続ける。
 * #4 がマージされたら、こちらは消してデモデータを読む。
 */
import { addMinutes, toJstIso } from '@/features/reservation/logic';
import { createEmptyState, type Action, type ReflectionRecord, type ReserveState } from '@/shared/types';

/** 画面の見え方が変わる4つの状態（Issue #10 の完了条件） */
export type SampleVariant = 'empty' | 'scheduled' | 'awaiting' | 'reviewed';
export const SAMPLE_VARIANTS: { value: SampleVariant; label: string }[] = [
  { value: 'empty', label: 'まだ予定がない' },
  { value: 'scheduled', label: '予定がある' },
  { value: 'awaiting', label: '確認待ちがある' },
  { value: 'reviewed', label: '振り返り済み' },
];

export function isSampleVariant(value: string | null): value is SampleVariant {
  return SAMPLE_VARIANTS.some(item => item.value === value);
}

function shift(now: Date, hours: number): string {
  return toJstIso(new Date(now.getTime() + hours * 60 * 60 * 1000));
}

function action(overrides: Partial<Action> & Pick<Action, 'id' | 'title'>): Action {
  return {
    planId: 'sample_plan', monthlyId: null, durationMin: 30, place: '自宅',
    prep: ['スマートフォン'], fallback: '名前を調べるだけでも大丈夫です',
    startMessage: '申し込まなくて大丈夫。見るだけ。',
    reservationNo: null, isFirstDay: false, status: 'unscheduled',
    start: null, end: null,
    calendar: { method: null, eventId: null, htmlLink: null, confirmedAt: null },
    origin: 'tree', ...overrides,
  };
}

function record(overrides: Partial<ReflectionRecord> & Pick<ReflectionRecord, 'id' | 'actionId' | 'recordedAt'>): ReflectionRecord {
  return { result: 'done', feeling: 'fun', again: 'again', memo: '', ...overrides };
}

/** 見本の状態。now を基準に日時を作るので、いつ開いても過去日時にならない */
export function sampleHomeState(variant: SampleVariant, now: Date = new Date()): ReserveState {
  const base: ReserveState = {
    ...createEmptyState(),
    isDemo: true,
    demoPersona: 'sample',
    wish: { id: 'wish_sample', text: '陶芸をやってみたい', reason: null, category: 'activity', createdAt: shift(now, -72) },
    futureLife: {
      text: '月に一度、自分の手で何かを作る時間がある暮らし。',
      priceTag: {
        initialCost: { value: null, source: 'ai_estimate' },
        monthlyCost: { value: null, source: 'ai_estimate' },
        weeklyHours: { value: null, source: 'ai_estimate' },
      },
    },
  };
  if (variant === 'empty') return base;

  const soonStart = shift(now, 26);
  const pastStart = shift(now, -20);
  const doneStart = shift(now, -50);
  const actions: Action[] = [
    action({
      id: 'sample_next', title: '陶芸体験の空きを調べる', isFirstDay: true,
      status: 'registered', start: soonStart, end: addMinutes(soonStart, 30),
      reservationNo: 'RM-SAMPLE-001',
      calendar: { method: 'template', eventId: null, htmlLink: null, confirmedAt: shift(now, -1) },
    }),
    action({ id: 'sample_open', title: '作ってみたい器の写真を1枚選ぶ', durationMin: 10 }),
  ];
  if (variant === 'awaiting' || variant === 'reviewed') {
    actions.push(
      action({
        id: 'sample_past', title: '近くの陶芸教室を1つ見てみる', durationMin: 20,
        status: 'scheduled', start: pastStart, end: addMinutes(pastStart, 20),
      }),
    );
  }
  if (variant === 'reviewed') {
    actions.push(
      action({
        id: 'sample_done', title: '陶芸の動画を1本見る', durationMin: 15,
        status: 'done', start: doneStart, end: addMinutes(doneStart, 15),
      }),
    );
  }
  return {
    ...base,
    plans: [{ id: 'sample_plan', startedAt: shift(now, -72), closedAt: null, actionIds: actions.map(item => item.id) }],
    actions,
    records: variant === 'reviewed'
      ? [record({ id: 'sample_rec', actionId: 'sample_done', recordedAt: shift(now, -49), memo: '思ったより静かな時間だった' })]
      : [],
  };
}
