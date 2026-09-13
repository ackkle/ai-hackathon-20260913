/**
 * AI呼び出しの入口（AI-01〜06）。
 * mock … mocks/ai の固定JSONを返す
 * real … server/ai/<task>.ts を呼ぶ（W2で実装。未実装のものは NotImplemented）
 */
import { loadMock } from './mock';
import type { AiTask } from './schemas';

export type AiMode = 'mock' | 'real';

export class NotImplementedError extends Error {
  constructor(task: AiTask) {
    super(`AI_MODE=real はまだ実装していません（task: ${task}）`);
    this.name = 'NotImplementedError';
  }
}

export function getAiMode(): AiMode {
  return process.env.AI_MODE === 'real' ? 'real' : 'mock';
}

/** 本実装。W2 で task ごとに置き換える */
async function runReal(task: AiTask, _input: unknown): Promise<unknown> {
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
  return runReal(task, input);
}
