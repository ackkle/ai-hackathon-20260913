/**
 * お金の表示のガードレール（F-32、B案 §13.2）。
 * 金額を画面に出すときは必ずこの関数を通し、注記を一緒に表示する。
 */
import type { z } from 'zod';
import type { SourcedNumberSchema } from '@/shared/types';

type SourcedNumber = z.infer<typeof SourcedNumberSchema>;

/** 金額・費用の下に必ず出す注記。AIのシステムプロンプトでも同じ文を使う */
export const MONEY_NOTE = '目安です。実際の費用は確かめてください。利回りや税は含めていません。';

/** 数字の出どころの表示（第14.1節：統計の数値を作らない） */
export const SOURCE_LABEL: Record<SourcedNumber['source'], string> = {
  user: 'あなたの回答',
  stat: '統計',
  ai_estimate: 'AIの推定',
};

export type AmountView = {
  /** 例: 「30,000円」。値が無いときは「未定」 */
  text: string;
  /** 例: 「出どころ：AIの推定」 */
  sourceText: string;
  /** 金額があるときだけ注記を出す */
  note: string | null;
};

export function formatYen(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '未定';
  return `${Math.round(value).toLocaleString('ja-JP')}円`;
}

export function formatHours(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '未定';
  return `${Math.round(value * 10) / 10}時間`;
}

/** 金額の表示に必要なものを一度に作る。note は金額があるとき必ず入る */
export function describeAmount(amount: SourcedNumber): AmountView {
  const hasValue = amount.value !== null && Number.isFinite(amount.value);
  return {
    text: formatYen(amount.value),
    sourceText: `出どころ：${SOURCE_LABEL[amount.source]}${amount.assumed ? '（仮）' : ''}`,
    note: hasValue ? MONEY_NOTE : null,
  };
}
