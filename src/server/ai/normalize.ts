/**
 * 生成用の出力を、共有の応答スキーマの形に直す（B案 §9.5、mvp-spec 第8章）。
 *
 * ここは「コードがやること」だけを持つ純関数の集まり。
 *   - 件数の切り詰めと不足の検出
 *   - 数値の丸め（durationMin は 5〜240）
 *   - 出どころの検証（知らない statId は ai_estimate に格下げ）
 *   - 数字の計算（AI に計算させない）
 * 直せないもの（0件、期限の書式違いなど）は NormalizeError にして、
 * 呼び出し側が1回だけ作り直す（F-29）。
 */
import type {
  NextStepGeneration,
  QuestionsGeneration,
  TreeGeneration,
} from './generation-schemas';

export class NormalizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NormalizeError';
  }
}

/**
 * 「分からない」に当たる選択肢（B案 §9.5）。
 * 画面は allowUnknown を見て「分からない」を別枠で必ず出す（questions-screen.tsx）。
 * 選択肢の中にも同じものがあると2つ並ぶので、選択肢からは取り除いて allowUnknown に任せる。
 */
const UNKNOWN_WORDS = [
  '分からない',
  'わからない',
  '決まっていない',
  '思い当たらない',
  '考えたことがない',
];

const MIN_DURATION = 5;
const MAX_DURATION = 240;

/** 5〜240 に丸める（B案 §9.5「範囲外の時間は5または240に丸める」） */
function clampDuration(value: number): number {
  if (!Number.isFinite(value)) return MIN_DURATION;
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, Math.round(value)));
}

type GenSourcedNumber = { value: number | null; source: string; statId: string | null };

/**
 * 出どころを検証する。
 * source が知らない値なら ai_estimate、statId がアプリに無ければ ai_estimate に格下げする。
 * AI の見立てのときは assumed を立てて、画面が「AIの推定」と出せるようにする（第14.1節）。
 */
function normalizeSourced(input: GenSourcedNumber, knownStatIds: ReadonlySet<string>) {
  const value = typeof input.value === 'number' && Number.isFinite(input.value) ? input.value : null;
  let source: 'user' | 'stat' | 'ai_estimate' =
    input.source === 'user' || input.source === 'stat' ? input.source : 'ai_estimate';
  let statId = input.statId ?? null;

  if (source === 'stat' && (statId === null || !knownStatIds.has(statId))) {
    source = 'ai_estimate';
    statId = null;
  }
  if (source !== 'stat') statId = null;

  return { value, source, statId, ...(source === 'ai_estimate' ? { assumed: true } : {}) };
}

// ---------------------------------------------------------------- AI-01

export function normalizeQuestions(raw: QuestionsGeneration) {
  if (raw.questions.length === 0) {
    throw new NormalizeError('質問が0件でした');
  }

  const questions = raw.questions.slice(0, 5).map((question, index) => {
    const id = question.id.trim() || `q${index + 1}`;
    if (question.type === 'number') {
      return {
        id,
        text: question.text,
        purpose: question.purpose,
        type: 'number' as const,
        unit: question.unit?.trim() || undefined,
        allowUnknown: true,
      };
    }

    // 選択式は、答えになる選択肢だけを残す。「分からない」は allowUnknown で画面が出す
    const options = (question.options ?? [])
      .map(option => option.trim())
      .filter(Boolean)
      .filter(option => !UNKNOWN_WORDS.some(word => option.includes(word)))
      .slice(0, 5);
    if (options.length === 0) {
      throw new NormalizeError(`選択肢がありません: ${id}`);
    }
    return {
      id,
      text: question.text,
      purpose: question.purpose,
      type: question.type,
      options,
      allowUnknown: true,
    };
  });

  return {
    category: raw.category,
    wishSummary: raw.wishSummary,
    questions,
    distress: raw.distress,
  };
}

// ---------------------------------------------------------------- AI-03

const DEADLINE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** 期限が YYYY-MM で、今日より後、50年以内か（B案 §9.5） */
function checkDeadline(deadline: string, today: Date): void {
  if (!DEADLINE_PATTERN.test(deadline)) {
    throw new NormalizeError(`期限の書式が違います: ${deadline}`);
  }
  const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  if (deadline <= thisMonth) {
    throw new NormalizeError(`期限が今月より後になっていません: ${deadline}`);
  }
  if (Number(deadline.slice(0, 4)) > today.getFullYear() + 50) {
    throw new NormalizeError(`期限が50年より先です: ${deadline}`);
  }
}

/** 数字を計算する。必要な入力が欠けていれば計算しない（null のまま返す） */
function calculateMetric(
  kind: 'saving' | 'frequency' | 'price' | 'note',
  inputs: Record<string, { value: number | null }>,
): { value: number; unit: string; formula: string } | null {
  const numberOf = (key: string) => {
    const value = inputs[key]?.value;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };

  if (kind === 'saving') {
    const target = numberOf('target');
    const months = numberOf('months');
    if (target === null || months === null || months <= 0) return null;
    return { value: Math.round(target / months), unit: '円/月', formula: 'target ÷ months' };
  }
  if (kind === 'frequency') {
    const perMonth = numberOf('perMonth');
    if (perMonth === null) return null;
    return { value: Math.round(perMonth * 12), unit: '回/年', formula: 'perMonth × 12' };
  }
  if (kind === 'price') {
    const perVisit = numberOf('perVisit');
    if (perVisit === null) return null;
    return { value: Math.round(perVisit), unit: '円/回', formula: 'perVisit' };
  }
  return null;
}

/** 値札の範囲を確かめる（mvp-spec 第8章） */
function checkPriceTag(priceTag: {
  initialCost: { value: number | null };
  monthlyCost: { value: number | null };
  weeklyHours: { value: number | null };
}): void {
  for (const [label, entry] of [
    ['初期費用', priceTag.initialCost],
    ['月額', priceTag.monthlyCost],
  ] as const) {
    const value = entry.value;
    if (value !== null && (value < 0 || !Number.isInteger(value))) {
      throw new NormalizeError(`${label}は0以上の整数にしてください: ${value}`);
    }
  }
  const hours = priceTag.weeklyHours.value;
  if (hours !== null && (hours <= 0 || hours > 168)) {
    throw new NormalizeError(`週の時間は0より大きく168以下にしてください: ${hours}`);
  }
}

export function normalizeTree(
  raw: TreeGeneration,
  options: { today: Date; knownStatIds?: ReadonlySet<string> },
) {
  const knownStatIds = options.knownStatIds ?? new Set<string>();
  const sourced = (input: GenSourcedNumber) => normalizeSourced(input, knownStatIds);

  const priceTag = {
    initialCost: sourced(raw.futureLife.priceTag.initialCost),
    monthlyCost: sourced(raw.futureLife.priceTag.monthlyCost),
    weeklyHours: sourced(raw.futureLife.priceTag.weeklyHours),
  };
  checkPriceTag(priceTag);

  if (raw.goals.length === 0) throw new NormalizeError('目指す状態が0件でした');
  const goals = raw.goals.slice(0, 2).map(goal => {
    checkDeadline(goal.deadline, options.today);
    return { horizon: goal.horizon, text: goal.text, deadline: goal.deadline };
  });

  const metrics = raw.metrics.slice(0, 3).map((metric, index) => {
    const inputs = Object.fromEntries(
      metric.inputs.map(entry => [entry.key, sourced(entry.number)]),
    );
    return {
      id: metric.id.trim() || `met_${index + 1}`,
      label: metric.label,
      kind: metric.kind,
      inputs,
      result: calculateMetric(metric.kind, inputs),
      note: metric.note,
    };
  });
  const metricIds = new Set(metrics.map(metric => metric.id));

  const monthly = raw.monthly.slice(0, 3).map((action, index) => ({
    id: action.id.trim() || `mon_${index + 1}`,
    text: action.text,
    metricId: action.metricId && metricIds.has(action.metricId) ? action.metricId : null,
  }));
  const monthlyIds = new Set(monthly.map(action => action.id));

  if (raw.weekly.length === 0) throw new NormalizeError('今週の行動が0件でした');
  // 4件以上は先頭3件（B案 §9.5）
  const weekly = raw.weekly.slice(0, 3).map((action, index) => {
    if (!action.fallback.trim()) {
      throw new NormalizeError(`代わりの行動が空です: ${action.title}`);
    }
    return {
      id: action.id.trim() || `act_w1_${index + 1}`,
      monthlyId: action.monthlyId && monthlyIds.has(action.monthlyId) ? action.monthlyId : null,
      title: action.title,
      durationMin: clampDuration(action.durationMin),
      place: action.place,
      prep: action.prep,
      fallback: action.fallback,
      startMessage: action.startMessage,
      // 初日は先頭の1件だけにする（AI の申告は使わない）
      isFirstDay: index === 0,
    };
  });

  return {
    futureLife: { text: raw.futureLife.text, priceTag },
    tree: { goals, metrics, monthly, generatedAt: options.today.toISOString() },
    weekly,
    distress: raw.distress,
  };
}

// ---------------------------------------------------------------- AI-04

export function normalizeNextStep(raw: NextStepGeneration) {
  if (!raw.fallback.trim()) {
    throw new NormalizeError('代わりの行動が空です');
  }
  return {
    type: raw.type,
    title: raw.title,
    durationMin: clampDuration(raw.durationMin),
    prep: raw.prep,
    fallback: raw.fallback,
    reason: raw.reason,
    message: raw.message,
    distress: raw.distress,
  };
}
