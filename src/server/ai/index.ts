/**
 * AI呼び出しの入口（AI-01〜06）。
 * mock … mocks/ai の固定JSONを返す
 * real … 提供元（Claude / OpenAI）を呼ぶ。プロンプトは W2 で task ごとに足す
 */
import { loadMock } from './mock';
import { type LlmClient, createLlmClient, getAiProviderName } from './provider';
import type { AiTask } from './schemas';

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
 * 本実装。W2（#13）で task ごとにプロンプトを足す。
 * 提供元の違いは client が吸収するので、task 側は client.generateJson を呼ぶだけでよい。
 */
async function runReal(task: AiTask, _input: unknown, _client: LlmClient): Promise<unknown> {
  throw new NotImplementedError(task);
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
