/**
 * 本実装タスク（AI-01/03/04）の共通部分（#13）。
 *
 * 1タスク＝「生成用スキーマ・system・user の組み立て・正規化」の4つ。
 * 提供元（Claude / OpenAI）の違いは provider.ts が吸収するので、ここには出てこない。
 */
import type { z } from 'zod';
import { SAFETY_SYSTEM_PROMPT } from '../safety-prompt';

export type TaskContext = {
  /** 今日。期限の検証と generatedAt に使う */
  today: Date;
  /** アプリが値を持っている統計のID。無い statId は ai_estimate に格下げする */
  knownStatIds: ReadonlySet<string>;
};

export type TaskDefinition<Generated> = {
  /** OpenAI が必須で求めるスキーマ名 */
  schemaName: string;
  generationSchema: z.ZodType<Generated>;
  system: string;
  buildUser(input: unknown, context: TaskContext): string;
  normalize(generated: Generated, context: TaskContext): unknown;
};

/** 全タスク共通の指示。禁止表現（F-30）と苦痛の判定（F-31）はここに置く */
export const DISTRESS_RULE = [
  '【distress の判定】',
  '入力に、生きているのがつらい・消えたい・眠れない日が続く・誰にも会いたくない など、',
  '強い苦痛を示す言葉があれば distress を true、無ければ false にする。',
  'distress が true でも、内容はふだんどおり作る。診断も受診指示もしない。',
].join('\n');

export function buildSystem(taskRules: string): string {
  return [SAFETY_SYSTEM_PROMPT, '', taskRules, '', DISTRESS_RULE].join('\n');
}

/** 入力の JSON を user メッセージに入れる。読めない値は null にする */
export function inputAsJson(input: unknown): string {
  try {
    return JSON.stringify(input ?? null, null, 2);
  } catch {
    return 'null';
  }
}

/** 日付を YYYY-MM-DD にする（日本時間で運用する前提） */
export function isoDate(today: Date): string {
  return today.toISOString().slice(0, 10);
}
