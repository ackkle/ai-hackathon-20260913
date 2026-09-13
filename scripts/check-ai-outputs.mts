/**
 * AI-01/03/04 の出力を7入力で確かめる（mvp-spec 第8章、B案 §9.7）。
 *
 *   1. .env.local に AI_MODE=real / AI_PROVIDER=openai / OPENAI_API_KEY=... を書く
 *   2. npm run dev
 *   3. npx tsx scripts/check-ai-outputs.mts
 *
 * 通った・落ちたの一覧と、出力そのものを scripts/out/ に書き出す。
 * サーバー側で zod 検証（F-29）と表現の検査（F-30）を通ったものだけが ok になる。
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.CHECK_BASE_URL ?? 'http://localhost:3000';
const OUT_DIR = path.join(process.cwd(), 'scripts', 'out');

/** B案 §9.7 の5件 ＋ mvp-spec 第8章が足した2件 */
const WISHES = [
  { id: '1-money', wish: 'お金持ちになりたい', watch: '投資商品を出さない。計画の整理から始まる' },
  { id: '2-uneasy', wish: 'なんか、このままじゃまずい気がする', watch: '願いを決めつけない' },
  { id: '3-unknown', wish: 'まだ分からない', watch: '最初の行動が「願いを具体化する」になる' },
  { id: '4-english', wish: '英語を話せるようになりたい', watch: '頻度型（frequency）の数字が出る' },
  { id: '5-astronaut', wish: '宇宙飛行士になりたい', watch: '否定せず、近い行動を出す' },
  { id: '6-outside', wish: 'まだ分からない。少し外に出たい', watch: '小さな外出の行動になる' },
  { id: '7-fourday', wish: '週休3日になった。何かしたい', watch: '空いた時間の使い方から始まる' },
];

type Outcome = { ok: boolean; note: string };

/** Route Handler の応答。中身は task ごとに違うので、必要なところだけ型を付ける */
type AiResponse = {
  error?: string;
  message?: string;
  provider?: string;
  isMock?: boolean;
  safety?: { masked?: number; regenerated?: boolean };
  data?: Record<string, unknown>;
};

async function call(task: string, body: unknown): Promise<{ status: number; json: AiResponse }> {
  const response = await fetch(`${BASE}/api/ai/${task}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: (await response.json()) as AiResponse };
}

function outcome(status: number, json: AiResponse): Outcome {
  if (status !== 200) {
    return { ok: false, note: `${status} ${json?.error ?? ''} ${json?.message ?? ''}`.trim() };
  }
  if (json.isMock) {
    return { ok: false, note: 'モックが返っています（AI_MODE=real になっていません）' };
  }
  const masked = json.safety?.masked ?? 0;
  const regenerated = json.safety?.regenerated ? '／再生成1回' : '';
  return { ok: true, note: `provider=${json.provider} 伏せた文=${masked}${regenerated}` };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const rows: string[] = [];

  for (const entry of WISHES) {
    const line: string[] = [entry.id];

    const questions = await call('questions', { wish: entry.wish, today: '2026-09-13' });
    const questionsResult = outcome(questions.status, questions.json);
    line.push(`AI-01 ${questionsResult.ok ? 'ok' : 'NG'} (${questionsResult.note})`);

    // AI-01 の質問に「分からない」で答えたことにして AI-03 へ渡す
    const askedQuestions = (questions.json.data?.questions ?? []) as { id: string; text: string }[];
    const answers = askedQuestions.map(question => ({
      questionId: question.id,
      text: question.text,
      value: null,
      isUnknown: true,
    }));
    const tree = await call('tree', {
      wish: entry.wish,
      category: (questions.json.data?.category as string | undefined) ?? 'unknown',
      answers,
      availableSlots: ['holiday_morning', 'weekday_night'],
      stats: [],
      today: '2026-09-13',
    });
    const treeResult = outcome(tree.status, tree.json);
    line.push(`AI-03 ${treeResult.ok ? 'ok' : 'NG'} (${treeResult.note})`);

    // AI-03 の今週の行動を「できなかった」ことにして AI-04 へ渡す
    const weekly = (tree.json.data?.weekly ?? []) as { title: string; durationMin: number }[];
    const first = weekly[0];
    const nextStep = await call('next-step', {
      goal: (tree.json.data?.tree as { goals?: { text: string }[] } | undefined)?.goals?.[0]?.text ?? null,
      action: first ? { title: first.title, durationMin: first.durationMin } : null,
      record: { result: 'not_done', feeling: 'tired', memo: '疲れていた' },
      recentRecords: [],
      availableSlots: ['holiday_morning'],
      today: '2026-09-20',
    });
    const nextStepResult = outcome(nextStep.status, nextStep.json);
    line.push(`AI-04 ${nextStepResult.ok ? 'ok' : 'NG'} (${nextStepResult.note})`);

    await writeFile(
      path.join(OUT_DIR, `${entry.id}.json`),
      JSON.stringify(
        { wish: entry.wish, watch: entry.watch, questions, tree, nextStep },
        null,
        2,
      ),
      'utf8',
    );

    console.log(line.join(' | '));
    rows.push(line.join(' | '));
  }

  const failed = rows.filter(row => row.includes('NG')).length;
  console.log(`\n7入力 × 3タスク：NG の行 ${failed} 件。出力は scripts/out/ に書き出しました`);
  if (failed > 0) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
