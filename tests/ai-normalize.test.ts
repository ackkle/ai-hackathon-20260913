/**
 * AI出力の正規化（B案 §9.5、mvp-spec 第8章）。
 * 「計算と検証はコード」の部分を、AIを呼ばずに確かめる。
 */
import { describe, expect, it } from 'vitest';
import {
  NormalizeError,
  normalizeNextStep,
  normalizeQuestions,
  normalizeTree,
} from '../src/server/ai/normalize';
import {
  NextStepResponseSchema,
  QuestionsResponseSchema,
  TreeResponseSchema,
} from '../src/shared/types';

const TODAY = new Date('2026-09-13T00:00:00+09:00');

type Source = 'user' | 'stat' | 'ai_estimate';

function sourced(value: number | null, source: Source = 'ai_estimate', statId: string | null = null) {
  return { value, source, statId };
}

function treeInput(overrides: Record<string, unknown> = {}) {
  return {
    futureLife: {
      text: '週に2回、近くの工房で木工をしている',
      priceTag: {
        initialCost: sourced(60000),
        monthlyCost: sourced(8000),
        weeklyHours: sourced(6, 'user'),
      },
    },
    goals: [
      { horizon: '3y' as const, text: '月に4回は工房へ行っている', deadline: '2029-09' },
      { horizon: '1y' as const, text: '月に2回は工房へ行っている', deadline: '2027-09' },
    ],
    metrics: [
      {
        id: 'met_01',
        label: '道具の積み立て',
        kind: 'saving' as const,
        inputs: [
          { key: 'target', number: sourced(60000) },
          { key: 'months', number: sourced(12, 'user') },
        ],
        note: '金額は目安です',
      },
    ],
    monthly: [{ id: 'mon_01', text: '体験できる場所を3つ書き出す', metricId: 'met_01' }],
    weekly: [
      {
        id: 'act_01',
        monthlyId: 'mon_01',
        title: '場所を3つ書き出す',
        durationMin: 30,
        place: '自宅',
        prep: ['スマートフォン'],
        fallback: '1つ書くだけでも進んでいます',
        startMessage: '見るだけで大丈夫です',
        isFirstDay: false,
      },
    ],
    distress: false,
    ...overrides,
  };
}

describe('normalizeQuestions（AI-01）', () => {
  const base = {
    category: 'activity' as const,
    wishSummary: '打ち込める活動を持ちたい',
    distress: false,
  };

  it('選択式に「分からない」が無ければ足す', () => {
    const result = normalizeQuestions({
      ...base,
      questions: [
        {
          id: 'q1',
          text: '休日に使える時間は',
          purpose: '1回の長さを決めるため',
          type: 'single',
          options: ['1時間未満', '1〜3時間'],
          unit: null,
          allowUnknown: false,
        },
      ],
    });
    expect(result.questions[0].options).toEqual(['1時間未満', '1〜3時間', '分からない']);
    expect(result.questions[0].allowUnknown).toBe(true);
    expect(QuestionsResponseSchema.safeParse(result).success).toBe(true);
  });

  it('6問以上は5問に切り詰める', () => {
    const question = {
      text: '使える時間は',
      purpose: '長さを決めるため',
      type: 'number' as const,
      options: null,
      unit: '時間',
      allowUnknown: true,
    };
    const result = normalizeQuestions({
      ...base,
      questions: Array.from({ length: 7 }, (_, index) => ({ ...question, id: `q${index}` })),
    });
    expect(result.questions).toHaveLength(5);
    expect(QuestionsResponseSchema.safeParse(result).success).toBe(true);
  });

  it('0件は作り直しにする', () => {
    expect(() => normalizeQuestions({ ...base, questions: [] })).toThrow(NormalizeError);
  });
});

describe('normalizeTree（AI-03）', () => {
  it('数字はコードが計算する', () => {
    const result = normalizeTree(treeInput(), { today: TODAY });
    expect(result.tree.metrics[0].result).toEqual({
      value: 5000,
      unit: '円/月',
      formula: 'target ÷ months',
    });
    expect(TreeResponseSchema.safeParse(result).success).toBe(true);
  });

  it('入力が欠けていれば計算しない', () => {
    const input = treeInput();
    input.metrics[0].inputs[1].number = sourced(null, 'stat', 'ST-01');
    const result = normalizeTree(input, { today: TODAY });
    expect(result.tree.metrics[0].result).toBeNull();
  });

  it('アプリに無い statId は ai_estimate に格下げする', () => {
    const input = treeInput();
    input.metrics[0].inputs[0].number = sourced(60000, 'stat', 'ST-99');
    const result = normalizeTree(input, { today: TODAY });
    expect(result.tree.metrics[0].inputs.target).toMatchObject({
      source: 'ai_estimate',
      statId: null,
      assumed: true,
    });
  });

  it('今週の行動は先頭3件にして、時間を5〜240分に丸める', () => {
    const weekly = [0, 1, 2, 3].map(index => ({
      ...treeInput().weekly[0],
      id: `act_0${index}`,
      durationMin: index === 0 ? 1 : 600,
      isFirstDay: index === 3,
    }));
    const result = normalizeTree(treeInput({ weekly }), { today: TODAY });
    expect(result.weekly).toHaveLength(3);
    expect(result.weekly.map(action => action.durationMin)).toEqual([5, 240, 240]);
    expect(result.weekly.map(action => action.isFirstDay)).toEqual([true, false, false]);
  });

  it('期限が今月より後でなければ作り直しにする', () => {
    const input = treeInput();
    input.goals[0].deadline = '2026-09';
    expect(() => normalizeTree(input, { today: TODAY })).toThrow(NormalizeError);
  });

  it('週の時間が168を超えたら作り直しにする', () => {
    const input = treeInput();
    input.futureLife.priceTag.weeklyHours = sourced(200, 'user');
    expect(() => normalizeTree(input, { today: TODAY })).toThrow(NormalizeError);
  });

  it('代わりの行動が空なら作り直しにする', () => {
    const input = treeInput();
    input.weekly[0].fallback = '   ';
    expect(() => normalizeTree(input, { today: TODAY })).toThrow(NormalizeError);
  });
});

describe('normalizeNextStep（AI-04）', () => {
  const base = {
    type: 'smaller' as const,
    title: '場所を1つだけ書き写す',
    durationMin: 3,
    prep: [],
    fallback: '一覧を開いたところで終わっても大丈夫です',
    reason: '先週は時間が取れませんでした',
    message: '止まっていません',
    distress: false,
  };

  it('時間を5〜240分に丸める', () => {
    const result = normalizeNextStep(base);
    expect(result.durationMin).toBe(5);
    expect(NextStepResponseSchema.safeParse(result).success).toBe(true);
  });

  it('代わりの行動が空なら作り直しにする', () => {
    expect(() => normalizeNextStep({ ...base, fallback: '' })).toThrow(NormalizeError);
  });
});
