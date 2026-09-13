import { describe, expect, it } from 'vitest';
import { createEmptyState, ReserveStateSchema, type Action, type ReflectionRecord } from '../src/shared/types';
import {
  awaitingActions,
  enjoyed,
  futureLifeLine,
  hasSavedData,
  isAwaitingReview,
  nextPleasure,
  statusLabel,
  weeklyActions,
} from '../src/features/home/logic';
import { SAMPLE_VARIANTS, sampleHomeState } from '../src/features/home/sample';

const NOW = new Date('2026-09-19T12:00:00+09:00');

function action(overrides: Partial<Action> & Pick<Action, 'id'>): Action {
  return {
    planId: 'plan_01', monthlyId: null, title: '陶芸体験の空きを調べる', durationMin: 30,
    place: '自宅', prep: [], fallback: '見るだけで大丈夫です', startMessage: '',
    reservationNo: null, isFirstDay: false, status: 'unscheduled', start: null, end: null,
    calendar: { method: null, eventId: null, htmlLink: null, confirmedAt: null },
    origin: 'tree', ...overrides,
  };
}

function record(overrides: Partial<ReflectionRecord> & Pick<ReflectionRecord, 'id' | 'actionId'>): ReflectionRecord {
  return {
    result: 'done', feeling: 'fun', again: 'again', memo: '',
    recordedAt: '2026-09-19T11:00:00+09:00', ...overrides,
  };
}

function stateWith(actions: Action[], records: ReflectionRecord[] = []) {
  return {
    ...createEmptyState(),
    plans: [{ id: 'plan_01', startedAt: '2026-09-15T09:00:00+09:00', closedAt: null, actionIds: actions.map(item => item.id) }],
    actions,
    records,
  };
}

describe('F-20 次の楽しみ', () => {
  it('登録済みの行動が次の楽しみに出る', () => {
    const state = stateWith([
      action({ id: 'later', status: 'registered', start: '2026-09-21T10:00:00+09:00', end: '2026-09-21T10:30:00+09:00' }),
      action({ id: 'soon', status: 'registered', start: '2026-09-19T18:00:00+09:00', end: '2026-09-19T18:30:00+09:00' }),
    ]);
    expect(nextPleasure(state, NOW)?.id).toBe('soon');
  });

  it('終了時刻を過ぎた行動は次の楽しみに出さない', () => {
    const state = stateWith([
      action({ id: 'past', status: 'scheduled', start: '2026-09-19T09:00:00+09:00', end: '2026-09-19T09:30:00+09:00' }),
    ]);
    expect(nextPleasure(state, NOW)).toBeNull();
  });

  it('記録済み・見送りの行動は次の楽しみに出さない', () => {
    const state = stateWith([
      action({ id: 'done', status: 'done', start: '2026-09-20T10:00:00+09:00', end: '2026-09-20T10:30:00+09:00' }),
      action({ id: 'skipped', status: 'skipped', start: '2026-09-20T11:00:00+09:00', end: '2026-09-20T11:30:00+09:00' }),
    ]);
    expect(nextPleasure(state, NOW)).toBeNull();
  });
});

describe('F-20 確認待ち', () => {
  const past = action({ id: 'past', status: 'scheduled', start: '2026-09-19T09:00:00+09:00', end: '2026-09-19T09:30:00+09:00' });

  it('終了時刻を過ぎて記録が無い行動が確認待ちになる', () => {
    expect(isAwaitingReview(past, [], NOW)).toBe(true);
    expect(awaitingActions(stateWith([past]), NOW).map(item => item.id)).toEqual(['past']);
  });

  it('記録した行動は確認待ちに残らない', () => {
    const state = stateWith([{ ...past, status: 'done' }], [record({ id: 'rec_01', actionId: 'past' })]);
    expect(awaitingActions(state, NOW)).toHaveLength(0);
  });

  it('自動で「できなかった」にはしない（状態は元のまま）', () => {
    const state = stateWith([past]);
    expect(state.actions[0].status).toBe('scheduled');
    expect(statusLabel(past, [], NOW)).toBe('確認待ち');
  });
});

describe('F-20 状態の表示', () => {
  it('カレンダーの確認が取れているときだけ「登録済み」と出す', () => {
    const confirmed = action({
      id: 'a', status: 'registered', start: '2026-09-20T10:00:00+09:00', end: '2026-09-20T10:30:00+09:00',
      calendar: { method: 'template', eventId: null, htmlLink: null, confirmedAt: '2026-09-19T10:00:00+09:00' },
    });
    expect(statusLabel(confirmed, [], NOW)).toBe('登録済み');
    expect(statusLabel({ ...confirmed, status: 'scheduled' }, [], NOW)).toBe('日時確定（未登録）');
    expect(statusLabel({ ...confirmed, calendar: { ...confirmed.calendar, confirmedAt: null } }, [], NOW)).toBe('日時確定（未登録）');
  });

  it('日時未設定と結果の状態を出し分ける', () => {
    expect(statusLabel(action({ id: 'a' }), [], NOW)).toBe('日時未設定');
    expect(statusLabel(action({ id: 'a', status: 'partial' }), [], NOW)).toBe('少しできた');
    expect(statusLabel(action({ id: 'a', status: 'skipped' }), [], NOW)).toBe('見送り');
  });
});

describe('F-20 今週の予定', () => {
  it('開始日時の順に並べ、日時未設定は下、最大3件にする', () => {
    const state = stateWith([
      action({ id: 'none' }),
      action({ id: 'third', status: 'scheduled', start: '2026-09-22T10:00:00+09:00' }),
      action({ id: 'first', status: 'scheduled', start: '2026-09-20T10:00:00+09:00' }),
      action({ id: 'second', status: 'scheduled', start: '2026-09-21T10:00:00+09:00' }),
    ]);
    expect(weeklyActions(state).map(item => item.id)).toEqual(['first', 'second', 'third']);
  });
});

describe('F-20 楽しかった体験と10年後の生活', () => {
  it('本人が「楽しかった」「またやりたい」と記録したものだけを新しい順に出す', () => {
    const state = stateWith(
      [action({ id: 'a', title: '陶芸の動画を見る' }), action({ id: 'b', title: '教室を調べる' })],
      [
        record({ id: 'r1', actionId: 'a', recordedAt: '2026-09-17T10:00:00+09:00' }),
        record({ id: 'r2', actionId: 'b', feeling: 'tired', again: 'other', recordedAt: '2026-09-18T10:00:00+09:00' }),
      ],
    );
    expect(enjoyed(state).map(item => item.title)).toEqual(['陶芸の動画を見る']);
  });

  it('10年後の生活は1文だけにする', () => {
    const state = {
      ...createEmptyState(),
      futureLife: {
        text: '月に一度、自分の手で何かを作る時間がある。友人にも見せている。',
        priceTag: {
          initialCost: { value: null, source: 'ai_estimate' as const },
          monthlyCost: { value: null, source: 'ai_estimate' as const },
          weeklyHours: { value: null, source: 'ai_estimate' as const },
        },
      },
    };
    expect(futureLifeLine(state)).toBe('月に一度、自分の手で何かを作る時間がある。');
    expect(futureLifeLine(createEmptyState())).toBeNull();
  });
});

describe('F-20 保存済みデータの判定', () => {
  it('何も無ければ false、行動があれば true', () => {
    expect(hasSavedData(createEmptyState())).toBe(false);
    expect(hasSavedData(stateWith([action({ id: 'a' })]))).toBe(true);
  });
});

describe('見本データ（#4 が入るまでの代用）', () => {
  it('4つの状態すべてが保存形式として正しく、画面の入力がそろう', () => {
    for (const { value } of SAMPLE_VARIANTS) {
      const state = sampleHomeState(value, NOW);
      expect(() => ReserveStateSchema.parse(state)).not.toThrow();
      expect(state.isDemo).toBe(true);
      expect(weeklyActions(state).length).toBeLessThanOrEqual(3);
    }
  });

  it('状態ごとに次の楽しみ・確認待ちの有無が変わる', () => {
    expect(nextPleasure(sampleHomeState('empty', NOW), NOW)).toBeNull();
    expect(nextPleasure(sampleHomeState('scheduled', NOW), NOW)?.id).toBe('sample_next');
    expect(awaitingActions(sampleHomeState('scheduled', NOW), NOW)).toHaveLength(0);
    expect(awaitingActions(sampleHomeState('awaiting', NOW), NOW).map(item => item.id)).toEqual(['sample_past']);
    expect(enjoyed(sampleHomeState('reviewed', NOW))).toHaveLength(1);
  });
});
