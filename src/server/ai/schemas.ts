/**
 * AI-01〜06 の出力形式（仕様書 第8章）。
 * 検証は server/ai/validate.ts が入口。中身の厚い検査（F-30・F-32）は W2 で足す。
 */
import { z } from 'zod';
import { ValueWithSourceSchema } from '@/shared/types';

/** どの応答にも入れる「強い苦痛を示す入力か」の判定（F-31） */
export const SafetySchema = z.object({
  isDistress: z.boolean(),
  reason: z.string().nullable().default(null),
});

/** AI-01 質問を作る */
export const QuestionsOutputSchema = z.object({
  wishCategory: z.enum(['activity', 'place', 'relationship', 'learning', 'unknown']),
  questions: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        kind: z.enum(['choice', 'text']),
        choices: z.array(z.string()).default([]),
        allowUnknown: z.boolean().default(true),
      }),
    )
    .min(1)
    .max(5),
  safety: SafetySchema,
});

/** AI-02 体験候補を作る */
export const CandidatesOutputSchema = z.object({
  candidates: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        reason: z.string(),
        firstTry: z.string(),
        durationMin: z.number().int().gt(0),
        costYen: ValueWithSourceSchema.extend({ value: z.number().int().min(0) }),
      }),
    )
    .length(3),
  safety: SafetySchema,
});

/** ツリーが返す今週の行動。予約票（S-10）の元になる */
export const WeeklyActionSchema = z.object({
  id: z.string(),
  title: z.string(),
  durationMin: z.number().int().gt(0),
  place: z.string(),
  prep: z.array(z.string()),
  fallback: z.string(),
  startMessage: z.string(),
  isFirstDay: z.boolean(),
});

/** AI-03 10年後の生活・値札・逆算ツリーを作る */
export const TreeOutputSchema = z.object({
  futureLife: z.object({
    text: z.string(),
    priceTag: z.object({
      initialCost: ValueWithSourceSchema.extend({ value: z.number().int().min(0) }),
      monthlyCost: ValueWithSourceSchema.extend({ value: z.number().int().min(0) }),
      weeklyHours: ValueWithSourceSchema.extend({ value: z.number().gt(0).max(168) }),
    }),
  }),
  goals: z.array(
    z.object({
      horizon: z.enum(['10y', '3y', '1y', '3m']),
      text: z.string(),
      deadline: z.string(),
    }),
  ),
  metrics: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(['saving', 'frequency', 'price', 'note']),
      label: z.string(),
      value: z.number().nullable().default(null),
      unit: z.string().nullable().default(null),
      source: z.enum(['user', 'ai_estimate', 'stat']),
      statId: z.string().nullable().default(null),
    }),
  ),
  monthly: z.array(z.object({ month: z.string(), text: z.string() })),
  weeklyActions: z.array(WeeklyActionSchema).min(1).max(3),
  safety: SafetySchema,
});

/** AI-04 次の一歩を作る */
export const NextStepOutputSchema = z.object({
  proposal: z.object({
    kind: z.enum(['same', 'smaller', 'other', 'rest']),
    title: z.string(),
    reason: z.string(),
    message: z.string(),
    durationMin: z.number().int().gt(0),
    place: z.string(),
    prep: z.array(z.string()),
    fallback: z.string(),
  }),
  safety: SafetySchema,
});

/** AI-05 次の1週間の計画を作る */
export const NextWeekOutputSchema = z.object({
  weeklyActions: z.array(WeeklyActionSchema).min(1).max(3),
  note: z.string().nullable().default(null),
  safety: SafetySchema,
});

/** AI-06 記録から関心を見つける。構想デモでは常にモック */
export const InterestsOutputSchema = z.object({
  interests: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        evidence: z.string(),
      }),
    )
    .length(3),
  safety: SafetySchema,
});

/** URL の [task] に使う名前 */
export const AI_TASKS = [
  'questions',
  'candidates',
  'tree',
  'next-step',
  'next-week',
  'interests',
] as const;

export type AiTask = (typeof AI_TASKS)[number];

export const taskSchemas = {
  questions: QuestionsOutputSchema,
  candidates: CandidatesOutputSchema,
  tree: TreeOutputSchema,
  'next-step': NextStepOutputSchema,
  'next-week': NextWeekOutputSchema,
  interests: InterestsOutputSchema,
} as const satisfies Record<AiTask, z.ZodTypeAny>;

export function isAiTask(value: string): value is AiTask {
  return (AI_TASKS as readonly string[]).includes(value);
}
