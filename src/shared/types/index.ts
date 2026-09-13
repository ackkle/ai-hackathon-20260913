/**
 * 仕様書 第9章のデータ形式。W0で確定し凍結する。
 * 変更するときは、この変更だけの小さな PR を先に出してマージする。
 */
import { z } from 'zod';

export const SCHEMA_VERSION = 2;
export const STORAGE_KEY = 'reserve-machine:v2';

/** 値の出どころ（F-10）。統計から取ったときは statId を入れる */
export const ValueSourceSchema = z.enum(['user', 'ai_estimate', 'stat']);

/** 金額・時間などの1つの値と、その出どころ */
export const ValueWithSourceSchema = z.object({
  value: z.number(),
  source: ValueSourceSchema,
  statId: z.string().nullable().default(null),
});

/** 空白の大きさ（F-02）。source は制度からの計算か本人の回答か */
export const BlankSchema = z.object({
  type: z.enum(['four_day_week', 'retirement', 'custom']),
  hoursPerWeek: z.number().min(0),
  daysPerYear: z.number().min(0),
  hoursPer10Years: z.number().min(0),
  source: z.enum(['policy_calc', 'user']),
});

/** 入口の種類（S-02） */
export const EntrySchema = z.object({
  type: z.enum(['wish', 'unknown', 'records_demo']),
});

/** 願い（S-03） */
export const WishSchema = z.object({
  id: z.string(),
  text: z.string(),
  reason: z.string().nullable().default(null),
  category: z.enum(['activity', 'place', 'relationship', 'learning', 'unknown']),
  createdAt: z.string(),
});

/** 質問への回答（S-06）。分からないときは isUnknown を立てる */
export const AnswerSchema = z.object({
  questionId: z.string(),
  value: z.array(z.string()),
  isUnknown: z.boolean().default(false),
});

/** 値札（F-07）。初期費用・月額は0以上の整数、週の時間は0より大きく168以下 */
export const PriceTagSchema = z.object({
  initialCost: ValueWithSourceSchema.extend({ value: z.number().int().min(0) }),
  monthlyCost: ValueWithSourceSchema.extend({ value: z.number().int().min(0) }),
  weeklyHours: ValueWithSourceSchema.extend({ value: z.number().gt(0).max(168) }),
});

/** 10年後の生活と値札（S-07） */
export const FutureLifeSchema = z.object({
  text: z.string(),
  priceTag: PriceTagSchema,
});

/** 逆算ツリーの目指す状態 */
export const GoalSchema = z.object({
  horizon: z.enum(['10y', '3y', '1y', '3m']),
  text: z.string(),
  deadline: z.string(),
});

/** 数字の型（saving / frequency / price / note） */
export const MetricSchema = z.object({
  id: z.string(),
  kind: z.enum(['saving', 'frequency', 'price', 'note']),
  label: z.string(),
  value: z.number().nullable().default(null),
  unit: z.string().nullable().default(null),
  source: ValueSourceSchema,
  statId: z.string().nullable().default(null),
});

/** 月の行動 */
export const MonthlyItemSchema = z.object({
  month: z.string(),
  text: z.string(),
});

export const TreeSchema = z.object({
  goals: z.array(GoalSchema),
  metrics: z.array(MetricSchema),
  monthly: z.array(MonthlyItemSchema),
});

/** 1週間の計画 */
export const PlanSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  closedAt: z.string().nullable().default(null),
  actionIds: z.array(z.string()),
});

/** 行動の状態（B案 §10.4） */
export const ActionStatusSchema = z.enum([
  'draft',
  'scheduled',
  'registered',
  'done',
  'not_done',
  'skipped',
  'replaced',
]);

/** カレンダー登録の記録。実際に入っていないものを「登録済み」と出さない（第14.1節） */
export const CalendarRefSchema = z.object({
  method: z.enum(['template', 'ics', 'api']).nullable().default(null),
  eventId: z.string().nullable().default(null),
  confirmedAt: z.string().nullable().default(null),
});

/** 行動＝予約票の中身（S-10） */
export const ActionSchema = z.object({
  id: z.string(),
  planId: z.string().nullable().default(null),
  title: z.string(),
  durationMin: z.number().int().gt(0),
  place: z.string(),
  prep: z.array(z.string()),
  fallback: z.string(),
  startMessage: z.string(),
  reservationNo: z.string().nullable().default(null),
  isFirstDay: z.boolean().default(false),
  status: ActionStatusSchema,
  start: z.string().nullable().default(null),
  end: z.string().nullable().default(null),
  calendar: CalendarRefSchema,
  origin: z.enum(['tree', 'next_step', 'next_week', 'candidate']),
});

/** 振り返り（S-13） */
export const RecordSchema = z.object({
  id: z.string(),
  actionId: z.string(),
  result: z.enum(['done', 'partly', 'not_done']),
  feeling: z.enum(['good', 'flat', 'tired', 'no_answer']),
  again: z.enum(['again', 'other', 'unknown', 'no_answer']),
  memo: z.string().default(''),
  recordedAt: z.string(),
});

/** 次の一歩の提案（S-14） */
export const ProposalSchema = z.object({
  id: z.string(),
  kind: z.enum(['same', 'smaller', 'other', 'rest']),
  title: z.string(),
  reason: z.string(),
  message: z.string(),
  createdAt: z.string(),
  acceptedActionId: z.string().nullable().default(null),
});

/** 履歴（S-16） */
export const HistoryItemSchema = z.object({
  id: z.string(),
  at: z.string(),
  kind: z.string(),
  text: z.string(),
});

export const SurveySchema = z.object({
  answers: z.array(z.object({ questionId: z.string(), value: z.string() })),
  submittedAt: z.string(),
});

/** localStorage に入るデータ全体 */
export const AppStateSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  isDemo: z.boolean().default(false),
  demoPersona: z.string().nullable().default(null),
  blank: BlankSchema.nullable().default(null),
  entry: EntrySchema.nullable().default(null),
  discovery: z
    .object({
      tomorrowMood: z.string().nullable().default(null),
      candidates: z.array(z.unknown()).default([]),
      selectedCandidateId: z.string().nullable().default(null),
    })
    .default({ tomorrowMood: null, candidates: [], selectedCandidateId: null }),
  wish: WishSchema.nullable().default(null),
  answers: z.array(AnswerSchema).default([]),
  futureLife: FutureLifeSchema.nullable().default(null),
  tree: TreeSchema.nullable().default(null),
  plans: z.array(PlanSchema).default([]),
  actions: z.array(ActionSchema).default([]),
  records: z.array(RecordSchema).default([]),
  proposals: z.array(ProposalSchema).default([]),
  history: z.array(HistoryItemSchema).default([]),
  survey: SurveySchema.nullable().default(null),
});

export type ValueSource = z.infer<typeof ValueSourceSchema>;
export type ValueWithSource = z.infer<typeof ValueWithSourceSchema>;
export type Blank = z.infer<typeof BlankSchema>;
export type Wish = z.infer<typeof WishSchema>;
export type Answer = z.infer<typeof AnswerSchema>;
export type PriceTag = z.infer<typeof PriceTagSchema>;
export type FutureLife = z.infer<typeof FutureLifeSchema>;
export type Goal = z.infer<typeof GoalSchema>;
export type Metric = z.infer<typeof MetricSchema>;
export type Tree = z.infer<typeof TreeSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type ActionStatus = z.infer<typeof ActionStatusSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type RecordItem = z.infer<typeof RecordSchema>;
export type Proposal = z.infer<typeof ProposalSchema>;
export type HistoryItem = z.infer<typeof HistoryItemSchema>;
export type AppState = z.infer<typeof AppStateSchema>;
