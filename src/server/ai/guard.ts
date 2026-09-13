/**
 * 使わない表現の検査（F-30）とお金のガードレール（F-32）。
 *
 * B案 §13.1（人を評価する言葉・結果の断言・行動の強要）と §13.2（投資商品・利回り・保証）に
 * 当たる語が AI 出力に含まれていないかをサーバー側で調べる。
 * 語のリストは data/banned-phrases.json に置き、ここは検査だけを行う純関数にする。
 *
 * 使い方（route.ts）：
 *   findings = inspectValue(data)  → 1件でもあれば1回だけ再生成
 *   それでも残る → maskValue(data) で該当文を伏せて表示する（仕様書 第15章）
 */
import bannedPhrasesFile from '../../../data/banned-phrases.json';

export type BannedCategoryId = 'judgment' | 'assertion' | 'coercion' | 'finance';

export type BannedCategory = {
  id: BannedCategoryId;
  label: string;
  source: string;
  phrases: string[];
};

export type SafetyFinding = {
  /** 出力のどこにあったか（例: weekly.0.startMessage） */
  path: string;
  category: BannedCategoryId;
  categoryLabel: string;
  phrase: string;
  /** 該当した文（伏せる単位） */
  sentence: string;
};

/** 伏せたときに代わりに出す文。画面にはこのまま表示される */
export const HIDDEN_SENTENCE = '（この文は表示していません）';

/** data/banned-phrases.json の中身。長い語から調べるので並べ替えておく */
export const bannedCategories: BannedCategory[] = (
  bannedPhrasesFile.categories as BannedCategory[]
).map(category => ({
  ...category,
  phrases: [...category.phrases].sort((a, b) => b.length - a.length),
}));

/** 文の区切り。区切り文字は前の文に残す */
function splitSentences(text: string): string[] {
  const parts = text.split(/(?<=[。！？!?\n])/);
  return parts.filter(part => part !== '');
}

/** 1つの文字列を検査する。該当が無ければ空配列 */
export function inspectText(
  text: string,
  path = '',
  categories: BannedCategory[] = bannedCategories,
): SafetyFinding[] {
  const findings: SafetyFinding[] = [];
  for (const sentence of splitSentences(text)) {
    for (const category of categories) {
      for (const phrase of category.phrases) {
        if (sentence.includes(phrase)) {
          findings.push({
            path,
            category: category.id,
            categoryLabel: category.label,
            phrase,
            sentence: sentence.trim(),
          });
          break; // 同じ文・同じ区分では最初の1語だけ報告する
        }
      }
    }
  }
  return findings;
}

/** AI出力（オブジェクト・配列・文字列）の中の文字列をすべて検査する */
export function inspectValue(
  value: unknown,
  categories: BannedCategory[] = bannedCategories,
  path = '',
): SafetyFinding[] {
  if (typeof value === 'string') {
    return inspectText(value, path, categories);
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      inspectValue(item, categories, path === '' ? String(index) : `${path}.${index}`),
    );
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) =>
      inspectValue(item, categories, path === '' ? key : `${path}.${key}`),
    );
  }
  return [];
}

/** 該当した文だけを HIDDEN_SENTENCE に置き換える。該当が無ければ元の文字列を返す */
export function maskText(
  text: string,
  categories: BannedCategory[] = bannedCategories,
): string {
  const sentences = splitSentences(text);
  const masked = sentences.map(sentence =>
    inspectText(sentence, '', categories).length > 0 ? HIDDEN_SENTENCE : sentence,
  );
  return masked.join('');
}

/** 出力の中の文字列を、該当文だけ伏せた形にして返す。元の値は変えない */
export function maskValue<T>(value: T, categories: BannedCategory[] = bannedCategories): T {
  if (typeof value === 'string') {
    return maskText(value, categories) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map(item => maskValue(item, categories)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).map(([key, item]) => [key, maskValue(item, categories)]);
    return Object.fromEntries(entries) as T;
  }
  return value;
}
