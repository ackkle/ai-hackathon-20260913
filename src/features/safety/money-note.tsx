/**
 * 金額の表示部品（F-32）。値札・費用の目安はこれを使い、注記を必ず一緒に出す。
 */
import type { z } from 'zod';
import type { SourcedNumberSchema } from '@/shared/types';
import { MONEY_NOTE, describeAmount, formatHours } from './money';

type SourcedNumber = z.infer<typeof SourcedNumberSchema>;

/** 金額の注記だけを出す。複数の金額をまとめて出す画面で使う */
export function MoneyNote() {
  return (
    <p className="text-xs text-[var(--muted,#5b6b57)] mt-1">{MONEY_NOTE}</p>
  );
}

/** 1つの金額と、その出どころ・注記 */
export function Amount({ label, amount }: { label: string; amount: SourcedNumber }) {
  const view = describeAmount(amount);
  return (
    <div className="mb-3">
      <p className="text-sm font-semibold">
        {label}：{view.text}
      </p>
      <p className="text-xs text-[var(--muted,#5b6b57)]">{view.sourceText}</p>
      {view.note !== null && <MoneyNote />}
    </div>
  );
}

/** 時間は金額ではないので注記を付けない */
export function Hours({ label, amount }: { label: string; amount: SourcedNumber }) {
  return (
    <p className="text-sm">
      {label}：{formatHours(amount.value)}
    </p>
  );
}
