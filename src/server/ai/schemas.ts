/**
 * AI-01〜06 の出力形式。
 * AI-01〜05 は凍結対象の `shared/types` にある応答スキーマをそのまま使う。
 * AI-06（構想デモ）だけ shared/types に無いので、ここで持つ。
 */
import { z } from 'zod';
import {
  CandidatesResponseSchema,
  NextStepResponseSchema,
  NextWeekResponseSchema,
  QuestionsResponseSchema,
  TreeResponseSchema,
} from '@/shared/types';

/** AI-06 記録から関心を見つける。構想デモでは常にモック */
export const InterestsResponseSchema = z.object({
  interests: z
    .array(z.object({ id: z.string(), label: z.string(), evidence: z.string() }))
    .length(3),
  distress: z.boolean().optional(),
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
  questions: QuestionsResponseSchema,
  candidates: CandidatesResponseSchema,
  tree: TreeResponseSchema,
  'next-step': NextStepResponseSchema,
  'next-week': NextWeekResponseSchema,
  interests: InterestsResponseSchema,
} as const satisfies Record<AiTask, z.ZodTypeAny>;

/** OpenAI の structured outputs はスキーマ名を必須で求める */
export const taskSchemaNames: Record<AiTask, string> = {
  questions: 'QuestionsResponse',
  candidates: 'CandidatesResponse',
  tree: 'TreeResponse',
  'next-step': 'NextStepResponse',
  'next-week': 'NextWeekResponse',
  interests: 'InterestsResponse',
};

export function isAiTask(value: string): value is AiTask {
  return (AI_TASKS as readonly string[]).includes(value);
}
