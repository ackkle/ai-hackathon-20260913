import { describe, expect, it } from 'vitest';
import mockTree from '../mocks/ai/tree.json';
import { createEmptyState, ReserveStateSchema } from '../src/shared/types';
import { createTreeState } from '../src/features/tree/logic';

const now = '2026-09-13T05:00:00.000Z';
function input() {
  const state = createEmptyState();
  state.wish = { id: 'wish-user', text: '木工を始めたい', reason: '作る時間がほしい', category: 'activity', createdAt: now };
  state.answers = [{ questionId: 'fixed_slots', value: ['holiday_morning'], isUnknown: false }];
  state.blank = { type: 'four_day_week', hoursPerWeek: 8, hoursPer10Years: 4160, source: 'policy_calc' };
  return state;
}
const envelope = () => ({ task: 'tree', isMock: true, data: structuredClone(mockTree) });
const ids = () => { let n = 0; return () => `new-${++n}`; };

describe('tree generation persistence', () => {
  it('saves a complete linked plan without changing answers, wish, or the input', () => {
    const state = input(); const before = structuredClone(state);
    const result = createTreeState(state, envelope(), now, ids());
    expect(ReserveStateSchema.safeParse(result).success).toBe(true);
    expect(result.plans[0].actionIds).toEqual(result.actions.map(a => a.id));
    expect(result.actions.every(a => a.planId === result.plans[0].id && a.status === 'unscheduled' && a.start === null && a.calendar.confirmedAt === null && a.reservationNo === null)).toBe(true);
    expect(new Set(result.actions.map(a => a.id)).size).toBe(3);
    expect(result.wish).toEqual(before.wish); expect(result.answers).toEqual(before.answers);
    expect(result.blank).toEqual(before.blank); expect(state).toEqual(before);
    expect(result.isDemo).toBe(true);
  });
  it('refuses to replace saved plans or completed records on repeat generation', () => {
    const saved = createTreeState(input(), envelope(), now, ids());
    const before = structuredClone(saved);
    expect(() => createTreeState(saved, envelope(), now, ids())).toThrow();
    expect(saved).toEqual(before);
    const recordOnly = input();
    recordOnly.records.push({ id: 'r', actionId: 'old', result: 'done', feeling: 'fun', again: 'again', memo: '', recordedAt: now });
    expect(() => createTreeState(recordOnly, envelope(), now, ids())).toThrow();
  });
  it('requires answers and rejects malformed or non-tree responses', () => {
    expect(() => createTreeState(createEmptyState(), envelope(), now, ids())).toThrow();
    expect(() => createTreeState(input(), { ...envelope(), task: 'questions' }, now, ids())).toThrow();
    expect(() => createTreeState(input(), { ...envelope(), data: { weekly: [] } }, now, ids())).toThrow();
  });
  it('marks one first day even when the response marks none or several', () => {
    for (const flag of [true, false]) {
      const response = envelope(); response.data.weekly.forEach(a => { a.isFirstDay = flag; });
      const result = createTreeState(input(), response, now, ids());
      expect(result.actions.filter(a => a.isFirstDay)).toHaveLength(1);
      expect(result.actions[0].isFirstDay).toBe(true);
    }
  });
  it('does not mark real user results as demo, but preserves an existing demo flag', () => {
    const response = { ...envelope(), isMock: false };
    expect(createTreeState(input(), response, now, ids()).isDemo).toBe(false);
    const state = input(); state.isDemo = true; state.demoPersona = 'kenta';
    expect(createTreeState(state, response, now, ids()).demoPersona).toBe('kenta');
  });
});
