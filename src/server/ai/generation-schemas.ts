/**
 * AI に「この形で返して」と渡す生成用スキーマ（#13）。
 *
 * 共有の応答スキーマ（shared/types）をそのまま渡せない理由：
 * OpenAI の structured outputs（strict）は
 *   - すべての項目が required（`.optional()` は不可。任意項目は `.nullable()` で表す）
 *   - 配列の件数（minItems/maxItems）・数値の範囲・文字列の書式を指定できない
 *   - 任意のキーを持つオブジェクト（z.record）を扱えない
 * という制約がある。実際 `zodTextFormat(QuestionsResponseSchema)` は
 * 「`properties/distress` uses `.optional()` without `.nullable()`」で落ちる。
 *
 * そこで「生成用の素直な形」をここに置き、件数・範囲・出どころの補正は
 * normalize.ts がコードで行う（B案 §9.5「検証はコード」）。
 * 補正後の値は共有スキーマで検証する（F-29）。
 */
import { z } from 'zod';

/** 数字の出どころ。statId はアプリ内の統計IDで、無ければ null */
const GenSourcedNumber = z.object({
  value: z.number().nullable(),
  source: z.enum(['user', 'stat', 'ai_estimate']),
  statId: z.string().nullable(),
});

const GenPriceTag = z.object({
  initialCost: GenSourcedNumber,
  monthlyCost: GenSourcedNumber,
  weeklyHours: GenSourcedNumber,
});

/** AI-01 質問の作成 */
export const QuestionsGenerationSchema = z.object({
  category: z.enum(['money', 'activity', 'unknown']),
  wishSummary: z.string(),
  questions: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      purpose: z.string(),
      type: z.enum(['single', 'multi', 'number']),
      /** single / multi のときだけ選択肢。number のときは null */
      options: z.array(z.string()).nullable(),
      /** number のときだけ単位。それ以外は null */
      unit: z.string().nullable(),
      allowUnknown: z.boolean(),
    }),
  ),
  distress: z.boolean(),
});

/** 数字の入力値。z.record が使えないので「キーと値の組」の配列にする */
const GenMetricInput = z.object({
  key: z.string(),
  number: GenSourcedNumber,
});

/** AI-03 10年後の生活・値札・逆算ツリー */
export const TreeGenerationSchema = z.object({
  futureLife: z.object({ text: z.string(), priceTag: GenPriceTag }),
  goals: z.array(
    z.object({
      horizon: z.enum(['1y', '3y']),
      text: z.string(),
      /** YYYY-MM */
      deadline: z.string(),
    }),
  ),
  /** 計算はコードが行う。AI は型と入力値だけを出す（B案 §9.1） */
  metrics: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      kind: z.enum(['saving', 'frequency', 'price', 'note']),
      inputs: z.array(GenMetricInput),
      note: z.string(),
    }),
  ),
  monthly: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      /** 対応する数字の id。無ければ null */
      metricId: z.string().nullable(),
    }),
  ),
  weekly: z.array(
    z.object({
      id: z.string(),
      monthlyId: z.string().nullable(),
      title: z.string(),
      durationMin: z.number(),
      place: z.string(),
      prep: z.array(z.string()),
      fallback: z.string(),
      startMessage: z.string(),
      isFirstDay: z.boolean(),
    }),
  ),
  distress: z.boolean(),
});

/** AI-04 次の一歩 */
export const NextStepGenerationSchema = z.object({
  type: z.enum(['next', 'smaller', 'reschedule', 'rest', 'other']),
  title: z.string(),
  durationMin: z.number(),
  prep: z.array(z.string()),
  fallback: z.string(),
  reason: z.string(),
  message: z.string(),
  distress: z.boolean(),
});

export type QuestionsGeneration = z.infer<typeof QuestionsGenerationSchema>;
export type TreeGeneration = z.infer<typeof TreeGenerationSchema>;
export type NextStepGeneration = z.infer<typeof NextStepGenerationSchema>;
