/**
 * モック応答の読み込み（第10.2節）。
 * AI_MODE=mock のとき、mocks/ai/<task>.json をそのまま返す。
 * 本物のAIが失敗してもモックへ自動では切り替えない。
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AiTask } from './schemas';

export async function loadMock(task: AiTask): Promise<unknown> {
  const file = path.join(process.cwd(), 'mocks', 'ai', `${task}.json`);
  const text = await readFile(file, 'utf8');
  return JSON.parse(text) as unknown;
}
