/**
 * AI-03 10年後の生活・値札・逆算ツリー（B案 §9.4、C案 §8、mvp-spec 第8章）。
 *
 * 計算はコードが行う（B案 §9.1）。AI が出すのは
 * 「10年後の生活の文」「値札の見立て」「目指す状態」「数字の型と入力値」「月の行動」「今週の行動」まで。
 */
import { TreeGenerationSchema } from '../generation-schemas';
import { normalizeTree } from '../normalize';
import { type TaskDefinition, buildSystem, inputAsJson, isoDate } from './shared';

const RULES = [
  '【役割】願いと回答から、10年後の生活・値札・逆算ツリー・今週の行動を作る。',
  '',
  '【futureLife】10年後の生活を1〜2文で書く。暮らしの様子が見える具体の文にする。',
  'priceTag は、その生活を始めるための見立て。',
  '- initialCost：はじめに必要な金額（円、0以上の整数）。',
  '- monthlyCost：続けるための月額（円、0以上の整数）。',
  '- weeklyHours：週に使う時間（1〜168）。',
  '- 各項目の source は、本人が答えた値なら user、渡した stats の項目を使うなら stat（statId も入れる）、',
  '  それ以外は ai_estimate。stats に無いIDは使わない。分からない項目は value を null にする。',
  '',
  '【goals】2件。horizon が 3y のものと 1y のものを1件ずつ。',
  '- text は「〜している」という状態で書く。達成度や点数にしない。',
  '- deadline は YYYY-MM 形式。今月より後にする（1y は今日のおよそ1年後、3y はおよそ3年後の月）。',
  '',
  '【metrics】1〜3件。数字の「型」と「入力値」だけを出す。計算結果は書かない（アプリが計算する）。',
  '- kind と inputs の key は次の組み合わせだけを使う。',
  '  saving（積み立て）: key は target（目標額・円）と months（月数）。',
  '  frequency（回数）: key は perMonth（月あたりの回数）。',
  '  price（1回あたりの費用）: key は perVisit（円）。',
  '  note（計算しない覚え書き）: inputs は空の配列にする。',
  '- note には、その数字の読み方や「金額は目安です」という趣旨の一文を書く。',
  '- 利回り・複利・運用益の計算はしない。',
  '',
  '【monthly】1〜3件。今月やることを行動の文で書く。対応する数字があれば metricId に metrics の id を入れる。',
  '',
  '【weekly】1〜3件。今週できる行動。',
  '- durationMin は5〜240分。最初の1件は30分以内の小さな行動にする。',
  '- place は「自宅」「近所」など。実在する施設名・料金・空き状況は書かない。',
  '- prep は持ち物や開くもの。無ければ空の配列。',
  '- fallback は「ここまでで終わってもよい」という一段小さい行動。必ず入れる。',
  '- startMessage は始めるときの短い一言。急かさない。',
  '- isFirstDay は先頭の1件だけ true。',
  '- monthlyId は対応する monthly の id。無ければ null。',
].join('\n');

export const treeTask: TaskDefinition<ReturnType<typeof TreeGenerationSchema.parse>> = {
  schemaName: 'TreeGeneration',
  generationSchema: TreeGenerationSchema,
  system: buildSystem(RULES),
  buildUser(input, context) {
    const statIds = [...context.knownStatIds];
    return [
      `今日: ${isoDate(context.today)}`,
      `使える stats のID: ${statIds.length > 0 ? statIds.join(', ') : '（なし。source に stat は使わない）'}`,
      '',
      '願いと回答:',
      inputAsJson(input),
      '',
      '10年後の生活・値札・逆算ツリー・今週の行動を作ってください。',
    ].join('\n');
  },
  normalize(generated, context) {
    return normalizeTree(generated, {
      today: context.today,
      knownStatIds: context.knownStatIds,
    });
  },
};
