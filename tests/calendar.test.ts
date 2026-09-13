import { describe, expect, it } from 'vitest';
import {
  DETAILS_MAX,
  buildDetails,
  buildTemplateUrl,
  buildTitle,
  confirmRegistration,
  registrationLabel,
  toTemplateStamp,
} from '../src/features/calendar/logic';
import { createEmptyState, type Action, type ReserveState, type Wish } from '../src/shared/types';

const NOW = '2026-09-13T12:00:00+09:00';
const APP_URL = 'https://reserve-machine-team15.example.workers.dev';

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
    reservationNo: 'RM-20260919-001',
    isFirstDay: true,
    status: 'scheduled',
    start: '2026-09-19T10:00:00+09:00',
    end: '2026-09-19T10:30:00+09:00',
    calendar: { method: null, eventId: null, htmlLink: null, confirmedAt: null },
    origin: 'tree',
    ...patch,
  };
}

function wish(text = '陶芸をやってみたい'): Wish {
  return { id: 'wish_1', text, reason: null, category: 'activity', createdAt: NOW };
}

function stateWith(...actions: Action[]): ReserveState {
  return { ...createEmptyState(), actions };
}

describe('テンプレートURL（B案 §12.2）', () => {
  it('日時を日本時間の壁時計で組み立てる', () => {
    expect(toTemplateStamp('2026-09-19T10:00:00+09:00')).toBe('20260919T100000');
    // 端末のタイムゾーンに関係なく日本時間で出す
    expect(toTemplateStamp('2026-09-19T01:00:00Z')).toBe('20260919T100000');
    expect(toTemplateStamp('だめな値')).toBeNull();
  });

  it('タイトル・日時・タイムゾーン・詳細が入ったURLを作る', () => {
    const url = buildTemplateUrl(action(), wish(), APP_URL);
    expect(url).not.toBeNull();
    const parsed = new URL(url!);
    expect(parsed.origin + parsed.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(parsed.searchParams.get('action')).toBe('TEMPLATE');
    expect(parsed.searchParams.get('text')).toBe('【リザーブマシン】陶芸体験の空きを調べる');
    expect(parsed.searchParams.get('dates')).toBe('20260919T100000/20260919T103000');
    expect(parsed.searchParams.get('ctz')).toBe('Asia/Tokyo');
    expect(parsed.searchParams.get('details')).toContain('今回の一歩：陶芸体験の空きを調べる');
  });

  it('日時が決まっていない行動ではURLを作らない', () => {
    expect(buildTemplateUrl(action({ start: null, end: null }), wish(), APP_URL)).toBeNull();
  });

  it('タイトルに目印を付ける（B案 FR-08）', () => {
    expect(buildTitle(action({ title: '土に触る' }))).toBe('【リザーブマシン】土に触る');
  });
});

describe('説明欄（B案 FR-08）', () => {
  it('願い・一歩・準備・気が重いときは・アプリのURLを入れる', () => {
    const details = buildDetails(action(), wish(), APP_URL);
    expect(details).toContain('やりたいこと：陶芸をやってみたい');
    expect(details).toContain('今回の一歩：陶芸体験の空きを調べる');
    expect(details).toContain('準備：スマートフォン');
    expect(details).toContain('気が重いときは：教室の名前を検索するだけでも大丈夫です');
    expect(details).toContain(APP_URL);
  });

  it('準備が無いときも空欄にしない', () => {
    expect(buildDetails(action({ prep: [] }), null, APP_URL)).toContain('準備：特にありません');
  });

  it('長すぎる説明は上限で切る（Q-04）', () => {
    const details = buildDetails(action({ fallback: 'あ'.repeat(900) }), wish(), APP_URL);
    expect(details.length).toBe(DETAILS_MAX);
    expect(details.endsWith('…')).toBe(true);
  });
});

describe('本人確認（第14.1節：確認していない予定を登録済みにしない）', () => {
  it('押す前は未登録のまま', () => {
    const target = action();
    expect(registrationLabel(target)).toBe('未登録');
    expect(target.status).toBe('scheduled');
    expect(target.calendar.confirmedAt).toBeNull();
  });

  it('押したときだけ registered・template・confirmedAt を保存する', () => {
    const target = action();
    const next = confirmRegistration(stateWith(target), target, { now: NOW, historyId: 'hist_1' });
    expect(next.action.status).toBe('registered');
    expect(next.action.calendar.method).toBe('template');
    expect(next.action.calendar.confirmedAt).toBe(NOW);
    // テンプレートURLでは予定IDとリンクを受け取れないので null のまま
    expect(next.action.calendar.eventId).toBeNull();
    expect(next.action.calendar.htmlLink).toBeNull();
    expect(registrationLabel(next.action)).toBe('登録済み（本人確認）');
    expect(next.state.actions[0].status).toBe('registered');
  });

  it('元の状態を書き換えず、履歴を1件足す', () => {
    const target = action();
    const before = stateWith(target);
    const next = confirmRegistration(before, target, { now: NOW, historyId: 'hist_1' });
    expect(before.actions[0].calendar.confirmedAt).toBeNull();
    expect(before.history).toHaveLength(0);
    expect(next.state.history).toHaveLength(1);
    expect(next.state.history[0].actionId).toBe('act_1');
  });
});
