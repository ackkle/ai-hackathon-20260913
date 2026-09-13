/**
 * AI-04 次の一歩（B案 §9.6、A案 ③、mvp-spec 第8章）。
 * 入力：目指す状態・直前の行動・振り返り・直近5件の記録。出力：次の一歩1件。
 */
import { NextStepGenerationSchema } from '../generation-schemas';
import { normalizeNextStep } from '../normalize';
import { type TaskDefinition, buildSystem, inputAsJson, isoDate } from './shared';

const RULES = [
  '【役割】振り返りを受け取り、次の一歩を1件だけ出す。承認するまで予定は変わらない前提で書く。',
  '',
  '【type の選び方】',
  '- next：できたので、同じ方向で次に進む。',
  '- smaller：できなかった・疲れていた。同じ内容を、より小さく短い形にする。',
  '- reschedule：時間が合わなかった。内容は変えず、入れ直す。',
  '- rest：続けて休みが必要そう。休むこと自体を次の一歩にする。',
  '- other：上のどれにも当てはまらないとき。',
  '',
  '【出力】',
  '- title：行動を1文で。できなかったときは前より小さくする。',
  '- durationMin：5〜240分。smaller のときは直前の行動より短くする。',
  '- prep：持ち物や開くもの。無ければ空の配列。',
  '- fallback：ここまでで終わってもよい、という一段小さい行動。必ず入れる。',
  '- reason：なぜこの案にしたかを、記録の内容に触れながら1〜2文で。',
  '- message：短い一言。ねぎらうが、ほめて評価しない。次を強く勧めない。',
  '',
  '【気をつけること】',
  '- できなかったことを本人の性格や努力の問題にしない。',
  '- 連続日数・達成率・点数を出さない。',
  '- avoidTitle が入力にあるときは、その案とは違う内容にする。',
].join('\n');

export const nextStepTask: TaskDefinition<
  ReturnType<typeof NextStepGenerationSchema.parse>
> = {
  schemaName: 'NextStepGeneration',
  generationSchema: NextStepGenerationSchema,
  system: buildSystem(RULES),
  buildUser(input, context) {
    return [
      `今日: ${isoDate(context.today)}`,
      '',
      '目指す状態・直前の行動・振り返り・直近の記録:',
      inputAsJson(input),
      '',
      '次の一歩を1件だけ作ってください。',
    ].join('\n');
  },
  normalize(generated) {
    return normalizeNextStep(generated);
  },
};
