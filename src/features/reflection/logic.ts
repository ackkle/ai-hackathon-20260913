/**
 * F-21 振り返り / F-22 次の一歩 の計算部分（画面から切り離した純粋関数）。
 * 仕様: mvp-spec 第6.6節、A案 ③、B案 FR-10・FR-11。
 * 画面は React に、状態の作り替えはここに置く。テストは tests/reflection.test.ts。
 */
import type {
  Action,
  HistoryEntry,
  NextStepResponse,
  Proposal,
  ReflectionRecord,
  ReserveState,
} from '@/shared/types';

export type ReflectResult = ReflectionRecord['result'];
export type Feeling = NonNullable<ReflectionRecord['feeling']>;
export type Again = ReflectionRecord['again'];
export type NextStepType = NextStepResponse['type'];

/** B案 FR-10：ひとことは100文字まで */
export const MEMO_MAX = 100;

export const RESULT_OPTIONS: { value: ReflectResult; label: string }[] = [
  { value: 'done', label: 'できた' },
  { value: 'partial', label: '少しできた' },
  { value: 'not_done', label: 'できなかった' },
];

export const FEELING_OPTIONS: { value: Feeling; label: string }[] = [
  { value: 'fun', label: '楽しかった' },
  { value: 'neutral', label: 'ふつう' },
  { value: 'tired', label: 'しんどかった' },
  { value: 'no_answer', label: '回答しない' },
];

export const AGAIN_OPTIONS: { value: Again; label: string }[] = [
  { value: 'again', label: 'またやりたい' },
  { value: 'other', label: '別のことを試したい' },
  { value: 'unknown', label: 'まだ分からない' },
  { value: 'no_answer', label: '回答しない' },
];

/** 次の一歩の5種類（B案の4種類 + A案の「別の体験を試す」） */
export const NEXT_STEP_LABELS: Record<NextStepType, string> = {
  next: '次へ進む',
  smaller: '小さくする',
  reschedule: '日を変える',
  rest: '休む',
  other: '別の体験を試す',
};

export function makeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}

export function findAction(state: ReserveState, actionId: string): Action | null {
  return state.actions.find(action => action.id === actionId) ?? null;
}

export function findRecordByAction(state: ReserveState, actionId: string): ReflectionRecord | null {
  return state.records.find(record => record.actionId === actionId) ?? null;
}

export function createRecord(input: {
  id: string;
  actionId: string;
  result: ReflectResult;
  feeling: Feeling | null;
  again: Again;
  memo: string;
  now: string;
}): ReflectionRecord {
  return {
    id: input.id,
    actionId: input.actionId,
    result: input.result,
    feeling: input.feeling,
    again: input.again,
    memo: input.memo.slice(0, MEMO_MAX),
    recordedAt: input.now,
  };
}

/**
 * 記録を保存する。行動の状態も結果に合わせる（B案 §10.4 の状態遷移）。
 * 同じ行動への二重記録は作らず上書きし、前の値は履歴に残す（B案 FR-10）。
 */
export function applyRecord(
  state: ReserveState,
  record: ReflectionRecord,
  historyId: string,
): ReserveState {
  const previous = findRecordByAction(state, record.actionId);
  const records = previous
    ? state.records.map(item => (item.id === previous.id ? { ...record, id: previous.id } : item))
    : [...state.records, record];
  const history: HistoryEntry[] = previous
    ? [
        ...state.history,
        {
          id: historyId,
          actionId: record.actionId,
          change: 'record_edit',
          before: { ...previous },
          after: { ...record, id: previous.id },
          at: record.recordedAt,
        },
      ]
    : state.history;
  return {
    ...state,
    records,
    history,
    actions: state.actions.map(action =>
      action.id === record.actionId ? { ...action, status: record.result } : action,
    ),
  };
}

/**
 * B案 FR-11：結果が「できなかった」か気持ちが「しんどかった」のとき「次へ進む」は出さない。
 */
export function isNextBlocked(record: Pick<ReflectionRecord, 'result' | 'feeling'>): boolean {
  return record.result === 'not_done' || record.feeling === 'tired';
}

/** 「次へ進む」が返ってきた場合はアプリ側で「小さくする」として扱い直す（B案 FR-11） */
export function normalizeNextStep<T extends { type: NextStepType }>(
  step: T,
  record: Pick<ReflectionRecord, 'result' | 'feeling'>,
): T {
  if (isNextBlocked(record) && step.type === 'next') return { ...step, type: 'smaller' };
  return step;
}

export function createProposal(input: {
  id: string;
  recordId: string;
  step: NextStepResponse;
}): Proposal {
  const { type, title, durationMin, prep, fallback, reason, message } = input.step;
  return {
    type, title, durationMin, prep, fallback, reason, message,
    id: input.id,
    recordId: input.recordId,
    state: 'pending',
    createdActionId: null,
    decidedAt: null,
  };
}

/** 承認したときだけ作る行動。日時とカレンダーは未設定のまま S-09 へ渡す（承認前は何も変えない） */
export function createActionFromProposal(input: {
  id: string;
  proposal: Proposal;
  planId: string;
  now: string;
}): Action {
  const { proposal } = input;
  return {
    id: input.id,
    planId: input.planId,
    monthlyId: null,
    title: proposal.title,
    durationMin: proposal.durationMin,
    place: '未定',
    prep: proposal.prep ?? [],
    fallback: proposal.fallback ?? 'ここまでで終わっても大丈夫です',
    startMessage: proposal.message ?? '',
    reservationNo: null,
    isFirstDay: false,
    status: 'unscheduled',
    start: null,
    end: null,
    calendar: { method: null, eventId: null, htmlLink: null, confirmedAt: null },
    origin: 'proposal',
    createdAt: input.now,
  };
}

/** 承認：提案を approved にし、新しい行動を1件足す。日時・カレンダーはまだ変えない */
export function applyApproval(
  state: ReserveState,
  proposal: Proposal,
  action: Action,
  now: string,
): ReserveState {
  const approved: Proposal = { ...proposal, state: 'approved', createdActionId: action.id, decidedAt: now };
  return {
    ...state,
    proposals: upsertProposal(state.proposals, approved),
    actions: [...state.actions, action],
    plans: state.plans.map(plan =>
      plan.id === action.planId ? { ...plan, actionIds: [...plan.actionIds, action.id] } : plan,
    ),
    history: [
      ...state.history,
      { id: makeId('hist'), actionId: action.id, change: 'create', before: null, after: { ...action }, at: now },
    ],
  };
}

/** 保留：提案の状態だけを held にする。行動・日時・カレンダーは変えない */
export function applyHold(state: ReserveState, proposal: Proposal, now: string): ReserveState {
  return {
    ...state,
    proposals: upsertProposal(state.proposals, { ...proposal, state: 'held', decidedAt: now }),
  };
}

function upsertProposal(proposals: Proposal[], proposal: Proposal): Proposal[] {
  return proposals.some(item => item.id === proposal.id)
    ? proposals.map(item => (item.id === proposal.id ? proposal : item))
    : [...proposals, proposal];
}

/** 行動の所属する計画。まだ計画が無ければ作る（承認したときだけ呼ぶ） */
export function ensurePlan(state: ReserveState, now: string): { state: ReserveState; planId: string } {
  const open = state.plans.find(plan => plan.closedAt === null);
  if (open) return { state, planId: open.id };
  const plan = { id: makeId('plan'), startedAt: now, closedAt: null, actionIds: [] };
  return { state: { ...state, plans: [...state.plans, plan] }, planId: plan.id };
}
