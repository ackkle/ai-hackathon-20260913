/**
 * AI-01 質問の作成（B案 §9.3、mvp-spec 第8章）。
 * 入力：願い（と、あれば入口の種類や空白）。出力：願いの種類・要約・質問 最大5問。
 */
import { QuestionsGenerationSchema } from '../generation-schemas';
import { normalizeQuestions } from '../normalize';
import { type TaskDefinition, buildSystem, inputAsJson, isoDate } from './shared';

const RULES = [
  '【役割】本人の願いを受け取り、次の段階（10年後の生活と逆算ツリー）を作るために必要な質問を作る。',
  '',
  '【出力】',
  '- category：お金に関わる願いなら money、活動や経験なら activity、まだ形になっていなければ unknown。',
  '- wishSummary：願いを1文で言い直す。決めつけず、本人の言葉を残す。',
  '- questions：1〜5問。少ないほうがよい。答えなくても先へ進める質問にする。',
  '',
  '【質問の作り方】',
  '- 1問につき1つのことだけ聞く。purpose に「何に使う質問か」を1文で書く。',
  '- type は single（1つ選ぶ）/ multi（複数選ぶ）/ number（数を書く）。',
  '- single・multi は options を2〜5件入れ、unit は null にする。',
  '  options に「分からない」「まだわからない」は入れない。アプリが別枠で必ず出す。',
  '- number は options を null にし、unit（「時間」「円」など）を入れる。',
  '- allowUnknown は必ず true にする。',
  '- 使える曜日と時間帯はアプリが固定で聞くので、質問に入れない。',
  '- 願いが money でも、具体的な金融商品や投資方法は聞かない。支出・目標額・期限までにとどめる。',
  '- 願いが unknown のときは、願いを当てにいかず「前に少しよかったこと」「困っている場面」を聞く。',
  '- 「宇宙飛行士になりたい」のような大きな願いも否定せず、その背景にある望みを聞く。',
].join('\n');

export const questionsTask: TaskDefinition<
  ReturnType<typeof QuestionsGenerationSchema.parse>
> = {
  schemaName: 'QuestionsGeneration',
  generationSchema: QuestionsGenerationSchema,
  system: buildSystem(RULES),
  buildUser(input, context) {
    return [
      `今日: ${isoDate(context.today)}`,
      '',
      '本人の入力:',
      inputAsJson(input),
      '',
      'この願いについて、質問を作ってください。',
    ].join('\n');
  },
  normalize(generated) {
    return normalizeQuestions(generated);
  },
};
