import { describe, expect, it } from 'vitest';
import {
  HIDDEN_SENTENCE,
  bannedCategories,
  inspectText,
  inspectValue,
  maskText,
  maskValue,
} from '../src/server/ai/guard';
import { MONEY_NOTE, describeAmount, formatYen } from '../src/features/safety/money';
import { SAFETY_SYSTEM_PROMPT } from '../src/server/ai/safety-prompt';

describe('F-30 使わない表現の検査', () => {
  it('人を評価する言葉を見つける', () => {
    const findings = inspectText('働いていない人は不要な人間です。');
    expect(findings).toHaveLength(1);
    expect(findings[0].category).toBe('judgment');
    expect(findings[0].phrase).toBe('不要な人間');
  });

  it('結果の断言と行動の強要を見つける', () => {
    const findings = inspectText('この計画なら必ず叶います。毎日やらなければならない。');
    expect(findings.map(f => f.category).sort()).toEqual(['assertion', 'coercion']);
  });

  it('普通の伴走の文には何も出ない', () => {
    const text = '5分だけ調べてみましょう。できない日は休んでも大丈夫です。';
    expect(inspectText(text)).toEqual([]);
  });

  it('AI出力の入れ子をたどって場所を返す', () => {
    const output = {
      weekly: [
        { title: '陶芸体験を調べる', startMessage: '見るだけでOK。' },
        { title: 'サボらずにやる', startMessage: '必ず成功します。' },
      ],
    };
    const findings = inspectValue(output);
    expect(findings.map(f => f.path)).toEqual(['weekly.1.title', 'weekly.1.startMessage']);
  });

  it('該当した文だけを伏せ、他の文は残す', () => {
    const text = '土曜の午前に30分だけ試します。できなければ堕落です。準備はスマホだけ。';
    const masked = maskText(text);
    expect(masked).toContain('土曜の午前に30分だけ試します。');
    expect(masked).toContain('準備はスマホだけ。');
    expect(masked).toContain(HIDDEN_SENTENCE);
    expect(masked).not.toContain('堕落');
  });

  it('maskValue は構造を保ったまま該当文だけ伏せる', () => {
    const output = { weekly: [{ title: '散歩する', startMessage: '必ず叶います。' }], count: 1 };
    const masked = maskValue(output);
    expect(masked.count).toBe(1);
    expect(masked.weekly[0].title).toBe('散歩する');
    expect(masked.weekly[0].startMessage).toBe(HIDDEN_SENTENCE);
    // 元の値は変えない
    expect(output.weekly[0].startMessage).toBe('必ず叶います。');
  });
});

describe('F-32 お金のガードレール', () => {
  it('利回り・元本保証を見つける', () => {
    expect(inspectText('年3%の利回りが見込めます。').map(f => f.category)).toEqual(['finance']);
    expect(inspectText('元本保証の商品です。').map(f => f.category)).toEqual(['finance']);
  });

  it('投資商品名を見つける', () => {
    const findings = inspectValue({ note: 'つみたてNISAで積み立てましょう。' });
    expect(findings[0].category).toBe('finance');
  });

  it('積立額の目安そのものは止めない（B案 §13.2 で認めている範囲）', () => {
    expect(inspectText('毎月2.7万円の積立が目安です。')).toEqual([]);
  });

  it('金額の表示には必ず注記が付く', () => {
    const view = describeAmount({ value: 30000, source: 'ai_estimate' });
    expect(view.text).toBe('30,000円');
    expect(view.sourceText).toBe('出どころ：AIの推定');
    expect(view.note).toBe(MONEY_NOTE);
  });

  it('金額が未定のときは注記を出さない', () => {
    const view = describeAmount({ value: null, source: 'user' });
    expect(formatYen(null)).toBe('未定');
    expect(view.note).toBeNull();
  });

  it('システムプロンプトに投資商品を出さない指示が入っている', () => {
    expect(SAFETY_SYSTEM_PROMPT).toContain('投資商品');
    expect(SAFETY_SYSTEM_PROMPT).toContain(MONEY_NOTE);
  });
});

describe('語のリスト', () => {
  it('4区分がそろっていて、すべて出典が書かれている', () => {
    expect(bannedCategories.map(c => c.id)).toEqual([
      'judgment',
      'assertion',
      'coercion',
      'finance',
    ]);
    for (const category of bannedCategories) {
      expect(category.phrases.length).toBeGreaterThan(0);
      expect(category.source).not.toBe('');
    }
  });
});
