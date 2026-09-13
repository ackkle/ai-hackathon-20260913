/**
 * AI出力の形式検証（F-29）の入口。
 * W0 では zod のスキーマ検査だけ。表現の検査（F-30）とお金のガードレール（F-32）は W2 で足す。
 */
import type { z } from 'zod';
import { type AiTask, taskSchemas } from './schemas';

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; issues: string[] };

/** 1つのタスクの出力を、そのタスクのスキーマで検証する */
export function validateAiOutput<T extends AiTask>(
  task: T,
  raw: unknown,
): ValidationResult<z.infer<(typeof taskSchemas)[T]>> {
  const schema: z.ZodTypeAny = taskSchemas[task];
  const parsed = schema.safeParse(raw);
  if (parsed.success) {
    return { ok: true, data: parsed.data as z.infer<(typeof taskSchemas)[T]> };
  }
  const issues = parsed.error.issues.map(
    (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
  );
  return { ok: false, issues };
}
