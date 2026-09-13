import { z } from 'zod';
import { ReserveStateSchema, TreeResponseSchema, type ReserveState } from '@/shared/types';

export const TreeEnvelopeSchema = z.object({
  task: z.literal('tree'), isMock: z.boolean(), data: TreeResponseSchema,
});

/** W1 creates the first plan only. Regeneration/replacement belongs to W4/W5. */
export function createTreeState(
  state: ReserveState, response: unknown, now: string,
  makeId: () => string = () => crypto.randomUUID(),
): ReserveState {
  if (!state.wish || state.answers.length === 0) throw new Error('先に質問に回答してください');
  if (state.tree || state.plans.length || state.actions.length || state.records.length || state.proposals.length || state.history.length) {
    throw new Error('保存済みの計画があります。ホームから続きを開いてください');
  }
  const { data, isMock } = TreeEnvelopeSchema.parse(response);
  const planId = `plan_${makeId()}`;
  const firstIndex = Math.max(0, data.weekly.findIndex(a => a.isFirstDay));
  const actions = data.weekly.map((action, index) => ({
    ...action, id: `act_${makeId()}`, planId, status: 'unscheduled' as const,
    isFirstDay: index === firstIndex, reservationNo: null, start: null, end: null,
    calendar: { method: null, eventId: null, confirmedAt: null },
    origin: 'tree' as const, createdAt: now,
  }));
  return ReserveStateSchema.parse({
    ...state, isDemo: state.isDemo || isMock,
    demoPersona: state.demoPersona ?? (isMock ? 'ai-sample' : null),
    futureLife: data.futureLife, tree: { ...data.tree, generatedAt: now },
    plans: [{ id: planId, startedAt: now, closedAt: null, actionIds: actions.map(a => a.id) }], actions,
  });
}
