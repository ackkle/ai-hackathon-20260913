/**
 * モック応答の読み込み（第10.2節）。
 * AI_MODE=mock のとき、mocks/ai/<task>.json をそのまま返す。
 * 本物のAIが失敗してもモックへ自動では切り替えない。
 */
import questions from '../../../mocks/ai/questions.json';
import candidates from '../../../mocks/ai/candidates.json';
import tree from '../../../mocks/ai/tree.json';
import nextStep from '../../../mocks/ai/next-step.json';
import nextWeek from '../../../mocks/ai/next-week.json';
import interests from '../../../mocks/ai/interests.json';
import type { AiTask } from './schemas';

// Static imports bundle the data into the Worker; runtime has no repo directory.
const mocks: Record<AiTask, unknown> = {
  questions, candidates, tree, 'next-step': nextStep, 'next-week': nextWeek, interests,
};

export async function loadMock(task: AiTask): Promise<unknown> {
  return structuredClone(mocks[task]);
}
