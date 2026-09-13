import { describe, expect, it } from 'vitest';
import { createEmptyState, ReserveStateSchema, type Action, type NextStepResponse } from '../src/shared/types';
import {
  applyApproval,
  applyHold,
  applyRecord,
  createActionFromProposal,
  createProposal,
  createRecord,
  ensurePlan,
  findRecordByAction,
  isNextBlocked,
  normalizeNextStep,
  MEMO_MAX,
} from '../src/features/reflection/logic';

const NOW = '2026-09-19T11:00:00+09:00';

function action(): Action {
  return {
    id: 'act_01', planId: 'plan_01', monthlyId: null,
    title: '陶芸体験の空きを調べる', durationMin: 30, place: '自宅',
    prep: ['スマートフォン'], fallback: '名前を検索するだけでもOK', startMessage: '見るだけ。',
    reservationNo: null, isFirstDay: true, status: 'registered',
    start: '2026-09-19T10:00:00+09:00', end: '2026-09-19T10:30:00+09:00',
    calendar: { method: 'template', eventId: null, htmlLink: null, confirmedAt: NOW },
    origin: 'tree',
  };
}

function stateWithAction() {
  return {
    ...createEmptyState(),
    plans: [{ id: 'plan_01', startedAt: NOW, closedAt: null, actionIds: ['act_01'] }],
    actions: [action()],
  };
}

function record(overrides: Partial<ReturnType<typeof createRecord>> = {}) {
  return {
    ...createRecord({
      id: 'rec_01', actionId: 'act_01', result: 'not_done',
      feeling: 'tired', again: 'no_answer', memo: '', now: NOW,
    }),
    ...overrides,
  };
}

const step: NextStepResponse = {
  type: 'smaller', title: '場所の名前を1つ書き写す', durationMin: 10,
  prep: ['スマートフォン'], fallback: '一覧を開いたところで終わっても大丈夫です',
  reason: '30分の調べものが残ったため、10分の大きさにしています',
  message: '止まっていません。',
};

describe('F-21 記録の保存', () => {
  it('記録を追加し、行動の状態を結果に合わせる', () => {
    const next = applyRecord(stateWithAction(), record({ result: 'done' }), 'hist_01');
    expect(next.records).toHaveLength(1);
    expect(next.actions[0].status).toBe('done');
    expect(next.history).toHaveLength(0);
    expect(() => ReserveStateSchema.parse(next)).not.toThrow();
  });

  it('同じ行動に二重の記録を作らず、前の値を履歴に残す', () => {
    const first = applyRecord(stateWithAction(), record({ result: 'not_done' }), 'hist_01');
    const second = applyRecord(first, record({ id: 'rec_02', result: 'partial' }), 'hist_02');
    expect(second.records).toHaveLength(1);
    expect(second.records[0].id).toBe('rec_01');
    expect(second.records[0].result).toBe('partial');
    expect(second.actions[0].status).toBe('partial');
    expect(second.history).toHaveLength(1);
    expect(second.history[0].change).toBe('record_edit');
    expect(findRecordByAction(second, 'act_01')?.result).toBe('partial');
  });

  it('ひとことは100文字で切る', () => {
    const long = createRecord({
      id: 'rec_03', actionId: 'act_01', result: 'done',
      feeling: null, again: 'again', memo: 'あ'.repeat(150), now: NOW,
    });
    expect(long.memo).toHaveLength(MEMO_MAX);
  });
});

describe('F-22 次の一歩（B案 FR-11）', () => {
  it('できなかった／しんどかったのとき「次へ進む」を出さない', () => {
    expect(isNextBlocked({ result: 'not_done', feeling: null })).toBe(true);
    expect(isNextBlocked({ result: 'done', feeling: 'tired' })).toBe(true);
    expect(isNextBlocked({ result: 'done', feeling: 'fun' })).toBe(false);
  });

  it('「次へ進む」が返ってきたら「小さくする」として扱い直す', () => {
    const blocked = normalizeNextStep({ ...step, type: 'next' }, { result: 'not_done', feeling: null });
    expect(blocked.type).toBe('smaller');
    const allowed = normalizeNextStep({ ...step, type: 'next' }, { result: 'done', feeling: 'fun' });
    expect(allowed.type).toBe('next');
  });

  it('保留では行動・日時・カレンダーが変わらない', () => {
    const base = applyRecord(stateWithAction(), record(), 'hist_01');
    const proposal = createProposal({ id: 'prop_01', recordId: 'rec_01', step });
    const held = applyHold(base, proposal, NOW);
    expect(held.actions).toEqual(base.actions);
    expect(held.plans).toEqual(base.plans);
    expect(held.history).toEqual(base.history);
    expect(held.proposals).toHaveLength(1);
    expect(held.proposals[0].state).toBe('held');
    expect(held.proposals[0].createdActionId).toBeNull();
    expect(() => ReserveStateSchema.parse(held)).not.toThrow();
  });

  it('承認すると日時未設定の行動が1件増える', () => {
    const base = applyRecord(stateWithAction(), record(), 'hist_01');
    const proposal = createProposal({ id: 'prop_01', recordId: 'rec_01', step });
    const withPlan = ensurePlan(base, NOW);
    const created = createActionFromProposal({ id: 'act_02', proposal, planId: withPlan.planId, now: NOW });
    const approved = applyApproval(withPlan.state, proposal, created, NOW);

    expect(approved.actions).toHaveLength(2);
    expect(created.status).toBe('unscheduled');
    expect(created.start).toBeNull();
    expect(created.calendar.confirmedAt).toBeNull();
    expect(created.origin).toBe('proposal');
    expect(approved.proposals[0].state).toBe('approved');
    expect(approved.proposals[0].createdActionId).toBe('act_02');
    // 元の行動と記録は変わらない
    expect(approved.actions[0]).toEqual(base.actions[0]);
    expect(approved.records).toEqual(base.records);
    expect(() => ReserveStateSchema.parse(approved)).not.toThrow();
  });

  it('計画が無いときだけ計画を作る', () => {
    const created = ensurePlan(createEmptyState(), NOW);
    expect(created.state.plans).toHaveLength(1);
    const reused = ensurePlan(created.state, NOW);
    expect(reused.planId).toBe(created.planId);
    expect(reused.state.plans).toHaveLength(1);
  });
});
