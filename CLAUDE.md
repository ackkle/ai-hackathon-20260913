# CLAUDE.md — リザーブマシン開発ガイド

AIハッカソン チーム15（2026年9月13日）。3人 + AI で開発する。

## 最初に読むもの（必ず）

1. `docs/specs/mvp-spec.md` — **正式仕様。** 機能ID（F-xx）、画面ID（S-xx）、AI呼び出し（AI-xx）、データ形式（第9章）、作る順番（第11章）、担当（第12章）、ディレクトリ（第13章）、完成条件（第14章）、チーム決定（第18章）はすべてここ。
2. 担当する Issue 本文。Issue には対象の機能ID・画面ID・完了条件・依存 Issue が書いてある。
3. 詳細が必要なときだけ元の案を見る：`docs/specs/member-a.md`（A案）、`member-b.md`（B案）、`member-c.md`（C案）。仕様書が「A案 §5 のとおり」と書いている箇所はここを参照する。

`mvp-proposal.md`・`mvp-proposal2.md`・`INTEGRATION.md` は経緯の記録。開発基準にはしない。

## 技術

- Next.js（App Router、TypeScript、Tailwind）を `@opennextjs/cloudflare` で Cloudflare Workers にデプロイ
- Node.js ランタイム。`export const runtime = 'edge'` は書かない
- AI は Claude API。呼び出しはサーバー側（`src/app/api/ai/[task]/route.ts` → `src/server/ai/`）のみ。キーをブラウザに出さない
- 保存は localStorage（キー `reserve-machine:v2`）。DBは使わない
- 環境変数：`next dev` は `.env.local`、`wrangler dev` と本番は `.dev.vars` / `wrangler secret put`。名前は `.env.example` に書く。キーはコミットしない

## 担当とフォルダ

| 担当 | 人 | GitHub | 主なフォルダ |
| --- | --- | --- | --- |
| ① 予約・保存・公開 | アックルさん | ackkle | `features/tree` `reservation` `calendar` `home` `settings`、`shared/storage`、`config/features.ts`、デプロイ |
| ② 入口・発見・画面 | リョウコさん | teresa9876 | `features/blank` `entry` `questions`（画面）、`shared/ui`、`demo/`、画面の文言 |
| ③ AI・伴走 | 亀ちゃん | kamekamek | `server/ai/`、`app/api/ai/`、`features/discovery` `future` `reflection` `safety`、`mocks/ai/` |

- 自分の担当フォルダ以外は原則触らない。触る必要があれば Issue か PR で先に相談する。
- **凍結対象**（`shared/types`、`shared/storage`、`config/features.ts`、`app/layout.tsx`、`globals.css`）を変えるときは、その変更だけの小さな PR を先に出してマージする。
- `app/` のページは薄く保ち、中身は `features/` に置く。

## 開発の流れ（Issue 駆動）

```
Issue を選ぶ → main から branch → 実装 → 動作確認 → PR → 別のメンバーがレビュー → main にマージ
```

1. **Issue を選ぶ。** ボード https://github.com/users/kamekamek/projects/9 で自分にアサインされた Issue を Todo から In Progress に動かす。Issue の「依存」欄にある Issue が Done でなければ着手しない。
2. **branch を切る。** `git switch main && git pull --ff-only && git switch -c feat/<issue番号>-<短い名前>`。例：`feat/8-ticket`
3. **実装する。** Issue の完了条件を満たすまで。間に合わない機能は `config/features.ts` のモードを `mock` か `off` にして、main を壊さない。
4. **動作確認する。** `npm run dev` で確認し、PR に確認した手順と結果を書く。未確認なら「未確認」と書く。
5. **PR を出す。** タイトルに Issue 番号（`#8`）、本文に `Closes #8`。テンプレート `.github/pull_request_template.md` に従う。
6. **レビューとマージ。** 別のメンバーが確認してマージ。自分でマージしない。マージ後は全員 `git pull` する。
7. **30分ごとに全員で公開URLを開き、一巡をクリックする。** ズレはここで見つける。

## Issue の作り方

- 画面ID か 機能ID の単位で切る。「API」「UI」などレイヤー単位では切らない
- 本文に書くこと：対象（F-xx / S-xx）、置き場所（フォルダ）、やること、**完了条件**、**依存 Issue**、参照する仕様書の章
- ラベル：Wave（W0〜W8）と 担当（担当①アックルさん／担当②リョウコさん／担当③亀ちゃん）
- 作成時に `gh issue create -a <GitHubユーザー名> -l "W1,担当①アックルさん"` でアサインまで行う
- 作ったらボードに追加：`gh project item-add 9 --owner kamekamek --url <Issue URL>`

## Wave の順番と依存

| Wave | 内容 | 依存 |
| --- | --- | --- |
| W0 | 雛形・共有層・機能モード・AIモック・デモデータ・公開URL | なし。#2（雛形）が全員の起点。#3・#4 は並行可 |
| W1 | 中心の一巡をモックで通す（S-02→S-14） | W0 |
| W2 | AI-01/03/04 を本物に、形式検証、ガードレール | W1 |
| W3 | 入口をそろえる（空白の提示、明日の過ごし方、体験候補） | W1 |
| W4 | 10年後と数字（値札、計算、出どころ、編集） | W2 |
| W5 | 伴走を厚く（日時候補、変更、次の1週間、履歴） | W1 |
| W6 | カレンダーを厚く（.ics、API） | W1 |
| W7 | 構想デモ G-01〜03 | W1 |
| W8 | 仕上げ（デモデータ3人分、設定、アンケート、スマホ幅） | 全部 |

W1 が終わった時点で発表できる状態にする。締め切りから逆算した「機能追加を止める時刻」（第18章）を過ぎたら、その時点の Wave で提出する。

## 守ること（仕様書 第14.1節）

- 実際にカレンダーに入っていない予定を「登録済み」と表示しない
- 統計の数値を作らない。未転記は「AIの推定」と表示する
- モックは「サンプル」、構想デモは「構想デモ（実際のデータではありません）」の帯を出す
- 人を評価する言葉、断言、強要を画面・AI出力に出さない（B案 §13.1）
- 投資商品・利回り・保証を出さない。金額には「目安です」を付ける
- 行動件数を達成率や点数に換算しない

## AI（Claude Code など）に頼むとき

- 担当する Issue 番号・機能ID・フォルダ・branch 名を伝える
- 仕様書 `docs/specs/mvp-spec.md` の該当章を読ませる
- 凍結対象のファイルを変えさせない
- 完了報告には動作確認の結果を含めさせる
