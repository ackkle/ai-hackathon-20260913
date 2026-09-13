/**
 * 機能モード（F-35）。仕様書 第10.1節。W0で確定し凍結する。
 * real   … 本実装
 * simple … 簡易実装
 * mock   … モック（画面に「サンプル」の帯を出す）
 * concept… 構想デモ（「構想デモ（実際のデータではありません）」の帯を出す）
 * off    … 隠す
 */
export type FeatureMode = 'real' | 'simple' | 'mock' | 'concept' | 'off';

export type FeatureId =
  | 'AI-01'
  | 'AI-02'
  | 'AI-03'
  | 'AI-04'
  | 'AI-05'
  | 'AI-06'
  | 'F-30'
  | 'F-32';

export const featureModes: Record<FeatureId, FeatureMode> = {
  'AI-01': 'mock',
  'AI-02': 'mock',
  'AI-03': 'mock',
  'AI-04': 'mock',
  'AI-05': 'mock',
  'AI-06': 'concept',
  'F-30': 'off',
  'F-32': 'off',
};

/** 画面に出す帯の文言。mock と concept のときだけ出す */
export const featureBanner: Record<FeatureMode, string | null> = {
  real: null,
  simple: null,
  mock: 'サンプル',
  concept: '構想デモ（実際のデータではありません）',
  off: null,
};

export function getFeatureMode(id: FeatureId): FeatureMode {
  return featureModes[id];
}
