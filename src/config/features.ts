export type FeatureMode = 'real' | 'simple' | 'mock' | 'concept' | 'off';
export type FeatureId = `F-${string}`;

export const featureModes: Record<FeatureId, FeatureMode> = Object.fromEntries(
  Array.from({ length: 40 }, (_, i) => [`F-${String(i + 1).padStart(2, '0')}`, 'mock' as FeatureMode]),
);
// Official spec §1.2: never mock successful external registration or support links.
featureModes['F-18'] = 'off';
featureModes['F-31'] = 'off';
featureModes['F-11'] = 'off';
for (const id of ['F-37', 'F-38', 'F-39'] as FeatureId[]) featureModes[id] = 'concept';
featureModes['F-26'] = 'real';
featureModes['F-35'] = 'real';
// 実装が入った機能。既定の mock のままだと、動いている画面にも「サンプル」の帯が出て
// 未完成の警告に見える（第10.1節：帯を出すのはモックのときだけ）。
for (const id of ['F-01', 'F-03', 'F-15', 'F-16', 'F-20', 'F-21'] as FeatureId[]) {
  featureModes[id] = 'real';
}
// 一部だけ入っている機能。F-14 は日時候補が未実装で手入力のみ、
// F-27・F-34 は全削除だけでカレンダー接続の解除とデモ読み込みは未実装。
for (const id of ['F-14', 'F-27', 'F-34'] as FeatureId[]) {
  featureModes[id] = 'simple';
}
/**
 * AI が答える機能。AI_MODE=real のときは本実装なので「サンプル」の帯を出さない。
 * F-06 質問（AI-01）／F-07 10年後と値札・F-08 逆算ツリー（AI-03）／F-22 次の一歩（AI-04）。
 *
 * 画面は 'use client' なので、ブラウザからは NEXT_PUBLIC_ の付いた変数しか読めない。
 * ここに入るのは 'mock' か 'real' の文字だけで、APIキーはサーバー側にとどまる。
 */
const AI_BACKED: FeatureId[] = ['F-06', 'F-07', 'F-08', 'F-22'];

function aiModeIsReal(): boolean {
  return (process.env.NEXT_PUBLIC_AI_MODE ?? process.env.AI_MODE) === 'real';
}

export function getFeatureMode(id: FeatureId): FeatureMode {
  if (AI_BACKED.includes(id) && aiModeIsReal()) return 'real';
  return featureModes[id] ?? 'off';
}
export const features = featureModes;
