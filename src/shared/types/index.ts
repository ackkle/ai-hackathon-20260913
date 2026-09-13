import { z } from 'zod';

export const IsoDateTimeSchema = z.string().datetime({ offset: true });
export const SourceSchema = z.enum(['user', 'stat', 'ai_estimate']);
export const SourcedNumberSchema = z.object({
  value: z.number().finite().nullable(), source: SourceSchema,
  statId: z.string().nullable().optional(), assumed: z.boolean().optional(),
});
export const PriceTagSchema = z.object({
  initialCost: SourcedNumberSchema, monthlyCost: SourcedNumberSchema,
  weeklyHours: SourcedNumberSchema,
});
export const FutureLifeSchema = z.object({ text: z.string(), priceTag: PriceTagSchema });
export const BlankSchema = z.object({
  type: z.enum(['ai', 'four_day_week', 'retirement', 'job_search', 'other']),
  hoursPerWeek: z.number().min(0).max(168), daysPerYear: z.number().min(0).max(366).optional(),
  hoursPer10Years: z.number().min(0), source: z.enum(['policy_calc', 'user']),
});
export const WishSchema = z.object({
  id: z.string().min(1), text: z.string().min(1), reason: z.string().nullable(),
  category: z.enum(['money', 'activity', 'unknown']), createdAt: IsoDateTimeSchema,
  summary: z.string().optional(),
});
export const AnswerSchema = z.object({
  questionId: z.string(), text: z.string().optional(),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]),
  isUnknown: z.boolean(),
});
export const QuestionSchema = z.object({
  id: z.string(), text: z.string(), purpose: z.string().optional(),
  type: z.enum(['single', 'multi', 'number']), options: z.array(z.string()).optional(),
  unit: z.string().optional(), allowUnknown: z.boolean().optional(),
});
export const CandidateSchema = z.object({
  id: z.string(), name: z.string(), reason: z.string(), firstStep: z.string(),
  durationMin: z.number().int().min(5).max(240), estimatedCost: z.number().min(0).optional(),
});
export const MetricSchema = z.object({
  id: z.string(), label: z.string(), kind: z.enum(['saving', 'frequency', 'price', 'note']),
  inputs: z.record(z.string(), SourcedNumberSchema).optional(),
  result: z.object({ value: z.number().finite(), unit: z.string(), formula: z.string() }).nullable().optional(),
  note: z.string().optional(),
});
export const GoalSchema = z.object({
  horizon: z.enum(['1y', '3y']), text: z.string(), deadline: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  editedByUser: z.boolean().optional(),
});
export const MonthlyActionSchema = z.object({ id: z.string(), text: z.string(), metricId: z.string().nullable().optional() });
export const TreeSchema = z.object({ goals: z.array(GoalSchema), metrics: z.array(MetricSchema), monthly: z.array(MonthlyActionSchema), generatedAt: IsoDateTimeSchema.optional() });
// Issues #7/#8 use proposed/reserved. Normalize on every persistence boundary.
export const ActionStatusSchema = z.enum(['unscheduled', 'scheduled', 'registered', 'done', 'partial', 'not_done', 'skipped', 'proposed', 'reserved'])
  .transform(value => value === 'proposed' ? 'unscheduled' as const : value === 'reserved' ? 'scheduled' as const : value);
export const CalendarSchema = z.object({
  method: z.enum(['template', 'ics', 'api']).nullable(), eventId: z.string().nullable(),
  htmlLink: z.string().url().nullable().optional(), confirmedAt: IsoDateTimeSchema.nullable(),
});
export const ActionSchema = z.object({
  id: z.string().min(1), planId: z.string(), monthlyId: z.string().nullable().optional(),
  title: z.string().min(1), durationMin: z.number().int().min(5).max(240),
  place: z.string(), prep: z.array(z.string()), fallback: z.string().min(1), startMessage: z.string(),
  reservationNo: z.string().nullable(), isFirstDay: z.boolean(), status: ActionStatusSchema,
  start: IsoDateTimeSchema.nullable(), end: IsoDateTimeSchema.nullable(), calendar: CalendarSchema,
  origin: z.enum(['tree', 'proposal']), createdAt: IsoDateTimeSchema.optional(),
});
export const PlanSchema = z.object({ id: z.string(), startedAt: IsoDateTimeSchema, closedAt: IsoDateTimeSchema.nullable(), actionIds: z.array(z.string()) });
export const RecordSchema = z.object({
  id: z.string(), actionId: z.string(), result: z.enum(['done', 'partial', 'not_done']),
  feeling: z.enum(['fun', 'neutral', 'tired', 'no_answer']).nullable(),
  again: z.enum(['again', 'other', 'unknown', 'no_answer']), memo: z.string(), recordedAt: IsoDateTimeSchema,
});
export const NextStepSchema = z.object({
  type: z.enum(['next', 'smaller', 'reschedule', 'rest', 'other']),
  title: z.string(), durationMin: z.number().int().min(5).max(240), prep: z.array(z.string()),
  fallback: z.string().min(1), reason: z.string(), message: z.string(),
});
export const ProposalSchema = NextStepSchema.extend({
  id: z.string(), recordId: z.string(), state: z.enum(['pending', 'approved', 'held', 'rejected']),
  createdActionId: z.string().nullable(), decidedAt: IsoDateTimeSchema.nullable(),
});
export const HistorySchema = z.object({
  id: z.string(), actionId: z.string(), change: z.enum(['create', 'reschedule', 'skip', 'replace', 'record_edit']),
  before: z.record(z.string(), z.unknown()).nullable(), after: z.record(z.string(), z.unknown()).nullable(), at: IsoDateTimeSchema,
});
export const SurveySchema = z.object({ wantToTry: z.boolean().nullable(), manageable: z.boolean().nullable(), useAgain: z.boolean().nullable() });
export const ReserveStateSchema = z.object({
  schemaVersion: z.literal(2), isDemo: z.boolean(), demoPersona: z.string().nullable(),
  blank: BlankSchema.nullable(), entry: z.object({ type: z.enum(['wish', 'unknown', 'records_demo']) }),
  discovery: z.object({ tomorrowMood: z.string().nullable(), candidates: z.array(CandidateSchema).max(3), selectedCandidateId: z.string().nullable() }),
  wish: WishSchema.nullable(), answers: z.array(AnswerSchema), availableSlots: z.array(z.string()).optional(),
  futureLife: FutureLifeSchema.nullable(), tree: TreeSchema.nullable(), plans: z.array(PlanSchema),
  actions: z.array(ActionSchema), records: z.array(RecordSchema), proposals: z.array(ProposalSchema),
  history: z.array(HistorySchema), survey: SurveySchema.nullable(),
});

export const QuestionsResponseSchema = z.object({
  category: z.enum(['money', 'activity', 'unknown']), wishSummary: z.string(),
  questions: z.array(QuestionSchema).min(1).max(5), distress: z.boolean().optional(),
});
export const CandidatesResponseSchema = z.object({ candidates: z.array(CandidateSchema).length(3), distress: z.boolean().optional() });
export const WeeklyActionSchema = z.object({
  id: z.string(), monthlyId: z.string().nullable().optional(), title: z.string(),
  durationMin: z.number().int().min(5).max(240), place: z.string(), prep: z.array(z.string()),
  fallback: z.string().min(1), startMessage: z.string(), isFirstDay: z.boolean(),
});
export const TreeResponseSchema = z.object({ futureLife: FutureLifeSchema, tree: TreeSchema, weekly: z.array(WeeklyActionSchema).min(1).max(3), distress: z.boolean().optional() });
export const NextStepResponseSchema = NextStepSchema.extend({ distress: z.boolean().optional() });
export const NextWeekResponseSchema = z.object({ weekly: z.array(WeeklyActionSchema).min(1).max(3), distress: z.boolean().optional() });

export type ReserveState = z.infer<typeof ReserveStateSchema>;
export type AppState = ReserveState;
export type Wish = z.infer<typeof WishSchema>;
export type Answer = z.infer<typeof AnswerSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type Candidate = z.infer<typeof CandidateSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type ActionStatus = z.infer<typeof ActionStatusSchema>;
export type ReflectionRecord = z.infer<typeof RecordSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type Proposal = z.infer<typeof ProposalSchema>;
export type HistoryEntry = z.infer<typeof HistorySchema>;
export type Tree = z.infer<typeof TreeSchema>;
export type FutureLife = z.infer<typeof FutureLifeSchema>;
export type QuestionsResponse = z.infer<typeof QuestionsResponseSchema>;
export type TreeResponse = z.infer<typeof TreeResponseSchema>;
export type NextStepResponse = z.infer<typeof NextStepResponseSchema>;

export function createEmptyState(): ReserveState {
  return {
    schemaVersion: 2, isDemo: false, demoPersona: null, blank: null,
    entry: { type: 'wish' }, discovery: { tomorrowMood: null, candidates: [], selectedCandidateId: null },
    wish: null, answers: [], futureLife: null, tree: null,
    plans: [], actions: [], records: [], proposals: [], history: [], survey: null,
  };
}
