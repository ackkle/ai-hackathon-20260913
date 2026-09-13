/**
 * AI呼び出しの入口（AI-01〜06）。
 * mock … mocks/ai の固定JSONを返す
 * real … 提供元（Claude / OpenAI）を呼ぶ。本実装は AI-01 / AI-03 / AI-04（#13）
 */
import { loadMock } from './mock';
import { NormalizeError } from './normalize';
import { AiOutputError, type LlmClient, createLlmClient } from './provider';
import type { AiTask } from './schemas';
import { nextStepTask } from './tasks/next-step';
import { questionsTask } from './tasks/questions';
import type { TaskContext, TaskDefinition } from './tasks/shared';
import { treeTask } from './tasks/tree';
import { validateAiOutput } from './validate';
export { taskSchemaNames } from './schemas';

export type AiMode = 'mock' | 'real';

export { AiConfigError, AiOutputError, getAiProviderName } from './provider';
export type { AiProviderName, LlmClient } from './provider';

export class NotImplementedError extends Error {
  constructor(task: AiTask) {
    super(`AI_MODE=real はまだ実装していません（task: ${task}）`);
    this.name = 'NotImplementedError';
  }
}

export function getAiMode(): AiMode {
  return process.env.AI_MODE === 'real' ? 'real' : 'mock';
}

/**
 * アプリが値を持っている統計のID。値札の出どころ（source: 'stat'）の検証に使う。
 * 統計データは W4 で入れる。それまでは空なので、AI が stat と言っても ai_estimate に格下げする。
 */
const KNOWN_STAT_IDS: ReadonlySet<string> = new Set<string>();

/** 本実装があるタスク。ここに無いものは mock のままで、real では 501 を返す */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const REAL_TASKS: Partial<Record<AiTask, TaskDefinition<any>>> = {
  questions: questionsTask,
  tree: treeTask,
  'next-step': nextStepTask,
};

/** 形式に合わないときに作り直す回数（F-28・F-29：自動でやり直すのは1回だけ） */
const MAX_ATTEMPTS = 2;

/**
 * 本実装。提供元の違いは client が吸収するので、ここは
 * 「作らせる → コードで直す → スキーマで検証する」だけを見る。
 * 形式に合わなければ1回だけ作り直し、それでも駄目なら AiOutputError にする。
 * 失敗してもモックへ自動で切り替えない（第10.2節）。
 */
async function runReal(task: AiTask, input: unknown, client: LlmClient): Promise<unknown> {
  const definition = REAL_TASKS[task];
  if (!definition) {
    throw new NotImplementedError(task);
  }

  const context: TaskContext = { today: new Date(), knownStatIds: KNOWN_STAT_IDS };
  const baseUser = definition.buildUser(input, context);
  let lastReason = '';

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const user =
      attempt === 0
        ? baseUser
        : `${baseUser}\n\n（前回の出力は形式に合いませんでした：${lastReason}。指示どおりの形で作り直してください）`;

    try {
      const generated = await client.generateJson({
        schema: definition.generationSchema,
        schemaName: definition.schemaName,
        system: definition.system,
        user,
      });
      const normalized = definition.normalize(generated, context);
      const validated = validateAiOutput(task, normalized);
      if (validated.ok) {
        return validated.data;
      }
      lastReason = validated.issues.join(' / ');
    } catch (error) {
      // 直せる見込みのある失敗だけ作り直す。キー未設定などはそのまま上へ返す
      if (error instanceof NormalizeError || error instanceof AiOutputError) {
        lastReason = error.message;
      } else {
        throw error;
      }
    }
  }

  throw new AiOutputError(`AIの出力が形式に合いませんでした（${lastReason}）`);
}

export async function runAiTask(
  task: AiTask,
  input: unknown,
  mode: AiMode = getAiMode(),
): Promise<unknown> {
  if (mode === 'mock') {
    return loadMock(task);
  }
  return runReal(task, input, createLlmClient());
}
