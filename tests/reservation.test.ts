import { describe, expect, it } from 'vitest';
import {
  addMinutes,
  applySchedule,
  checkSchedule,
  findOverlap,
  formatRange,
  fromLocalInput,
  nextReservationNo,
  toJstIso,
  toLocalInput,
} from '../src/features/reservation/logic';
import { createEmptyState, type Action, type ReserveState } from '../src/shared/types';

const NOW = '2026-09-13T12:00:00+09:00';

function action(patch: Partial<Action> = {}): Action {
  return {
    id: 'act_1',
    planId: 'plan_1',
    monthlyId: null,
    title: '陶芸体験の空きを調べる',
    durationMin: 30,
    place: '自宅',
    prep: ['スマートフォン'],
    fallback: '教室の名前を検索するだけでも大丈夫です',
    startMessage: '見るだけで大丈夫です',
    reservationNo: null,
    isFirstDay: true,
    status: 'unscheduled',
    start: null,
    end: null,
    calendar: { method: null, eventId: null, htmlLink: null, confirmedAt: null },
    origin: 'tree',
    ...patch,
  };
}

function stateWith(...actions: Action[]): ReserveState {
  return { ...createEmptyState(), actions };
}

describe('日時の扱い（NFR-09：日本時間で固定）', () => {
  it('datetime-local の値を日本時間として読む', () => {
    expect(fromLocalInput('2026-09-19T10:00')).toBe('2026-09-19T10:00:00+09:00');
    expect(toLocalInput('2026-09-19T10:00:00+09:00')).toBe('2026-09-19T10:00');
  });

  it('形式が違う値は読まない', () => {
    expect(fromLocalInput('2026/09/19 10:00')).toBeNull();
    expect(fromLocalInput('')).toBeNull();
  });

  it('端末のタイムゾーンに関係なく日本時間で書き出す', () => {
    expect(toJstIso(new Date('2026-09-19T01:00:00Z'))).toBe('2026-09-19T10:00:00+09:00');
  });

  it('所要時間を足して終了時刻を出す', () => {
    expect(addMinutes('2026-09-19T10:00:00+09:00', 30)).toBe('2026-09-19T10:30:00+09:00');
    expect(addMinutes('2026-09-19T23:45:00+09:00', 30)).toBe('2026-09-20T00:15:00+09:00');
  });

  it('9月19日（土）10:00〜10:30 の形で表示する', () => {
    expect(formatRange('2026-09-19T10:00:00+09:00', '2026-09-19T10:30:00+09:00')).toBe(
      '9月19日（土）10:00〜10:30',
    );
  });
});

describe('TC-12 過去の日時は確定できない', () => {
  it('過去の日時を入れるとエラーになる', () => {
    const result = checkSchedule(stateWith(action()), 'act_1', { localDateTime: '2026-09-12T10:00', durationMin: 30 }, NOW);
    expect(result).toEqual({ ok: false, error: '過去の日時は選べません' });
  });

  it('現在時刻ちょうども確定できない', () => {
    const result = checkSchedule(stateWith(action()), 'act_1', { localDateTime: '2026-09-13T12:00', durationMin: 30 }, NOW);
    expect(result.ok).toBe(false);
  });

  it('未来の日時は確定できる', () => {
    const result = checkSchedule(stateWith(action()), 'act_1', { localDateTime: '2026-09-19T10:00', durationMin: 30 }, NOW);
    expect(result).toEqual({
      ok: true,
      start: '2026-09-19T10:00:00+09:00',
      end: '2026-09-19T10:30:00+09:00',
      overlap: null,
    });
  });

  it('所要時間が範囲外ならエラーになる', () => {
    const tooLong = checkSchedule(stateWith(action()), 'act_1', { localDateTime: '2026-09-19T10:00', durationMin: 300 }, NOW);
    expect(tooLong.ok).toBe(false);
    const tooShort = checkSchedule(stateWith(action()), 'act_1', { localDateTime: '2026-09-19T10:00', durationMin: 1 }, NOW);
    expect(tooShort.ok).toBe(false);
  });
});

describe('TC-13 予定の重なり', () => {
  const booked = action({
    id: 'act_booked',
    status: 'registered',
    start: '2026-09-19T10:00:00+09:00',
    end: '2026-09-19T10:30:00+09:00',
  });

  it('重なる予定を警告として返す（エラーにはしない）', () => {
    const result = checkSchedule(stateWith(booked, action()), 'act_1', { localDateTime: '2026-09-19T10:15', durationMin: 30 }, NOW);
    expect(result.ok).toBe(true);
    expect(result.ok && result.overlap?.id).toBe('act_booked');
  });

  it('隣り合うだけの予定は重ならない', () => {
    const result = checkSchedule(stateWith(booked, action()), 'act_1', { localDateTime: '2026-09-19T10:30', durationMin: 30 }, NOW);
    expect(result.ok && result.overlap).toBeNull();
  });

  it('見送り・記録済みの行動とは重ならない', () => {
    const skipped = action({ ...booked, id: 'act_skipped', status: 'skipped' });
    expect(findOverlap([skipped], { actionId: 'act_1', start: '2026-09-19T10:00:00+09:00', end: '2026-09-19T10:30:00+09:00' })).toBeNull();
  });

  it('自分自身とは重ならない', () => {
    expect(findOverlap([booked], { actionId: 'act_booked', start: '2026-09-19T10:00:00+09:00', end: '2026-09-19T10:30:00+09:00' })).toBeNull();
  });
});

describe('予約番号 RM-YYYYMMDD-NNN', () => {
  it('同じ日の最初は 001 になる', () => {
    expect(nextReservationNo([], '2026-09-19T10:00:00+09:00')).toBe('RM-20260919-001');
  });

  it('同じ日に既にある番号の次を使う', () => {
    const actions = [
      action({ id: 'a', reservationNo: 'RM-20260919-001' }),
      action({ id: 'b', reservationNo: 'RM-20260919-002' }),
      action({ id: 'c', reservationNo: 'RM-20260920-001' }),
    ];
    expect(nextReservationNo(actions, '2026-09-19T18:00:00+09:00')).toBe('RM-20260919-003');
  });
});

describe('F-14 確定の保存', () => {
  it('状態を「日時確定（未登録）」にし、予約番号を発番して履歴に残す', () => {
    const before = stateWith(action());
    const { state, action: saved } = applySchedule(before, before.actions[0], {
      start: '2026-09-19T10:00:00+09:00',
      end: '2026-09-19T10:30:00+09:00',
      durationMin: 30,
      now: NOW,
      historyId: 'hist_1',
    });
    expect(saved.status).toBe('scheduled');
    expect(saved.reservationNo).toBe('RM-20260919-001');
    expect(state.history).toHaveLength(1);
    expect(state.history[0].change).toBe('create');
    expect(state.actions[0]).toEqual(saved);
  });

  it('日時を変えると履歴は reschedule になり、予約番号は変わらない', () => {
    const scheduled = action({
      status: 'scheduled',
      reservationNo: 'RM-20260919-001',
      start: '2026-09-19T10:00:00+09:00',
      end: '2026-09-19T10:30:00+09:00',
    });
    const { state, action: saved } = applySchedule(stateWith(scheduled), scheduled, {
      start: '2026-09-20T10:00:00+09:00',
      end: '2026-09-20T10:30:00+09:00',
      durationMin: 30,
      now: NOW,
      historyId: 'hist_2',
    });
    expect(state.history[0].change).toBe('reschedule');
    expect(saved.reservationNo).toBe('RM-20260919-001');
  });

  it('登録済みの行動の日時を変えたら、カレンダーの登録状態を外す（第14.1節）', () => {
    const registered = action({
      status: 'registered',
      reservationNo: 'RM-20260919-001',
      start: '2026-09-19T10:00:00+09:00',
      end: '2026-09-19T10:30:00+09:00',
      calendar: { method: 'template', eventId: null, htmlLink: null, confirmedAt: '2026-09-13T09:00:00+09:00' },
    });
    const { action: saved } = applySchedule(stateWith(registered), registered, {
      start: '2026-09-20T10:00:00+09:00',
      end: '2026-09-20T10:30:00+09:00',
      durationMin: 30,
      now: NOW,
      historyId: 'hist_3',
    });
    expect(saved.status).toBe('scheduled');
    expect(saved.calendar.confirmedAt).toBeNull();
    expect(saved.calendar.method).toBeNull();
  });
});
