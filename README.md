# AIハッカソン：チーム15

開催日：2026年9月13日

3〜4人で協力してアプリを開発するためのリポジトリです。

## アプリの土台（W0）

公開URL：[リザーブマシン](https://reserve-machine-team15.akira0208.workers.dev)

現在は22画面の雛形です。「サンプル／準備中」の表示があり、AI提案・予約・カレンダー登録はまだ実装していません。画面下部の「画面一覧を見る」から全画面を確認できます。

必要環境：Node.js 22.12以上（Node 22推奨）、npm。

```bash
npm ci
cp .env.example .env.local
cp .dev.vars.example .dev.vars
npm run dev
```

開発サーバーは `http://localhost:3000`。Workers実行環境は次のコマンドでビルドして `http://localhost:8787` に起動します。

```bash
npm run preview
```

```bash
npm test
npm run typecheck
npm run lint
```

公開担当がCloudflareにログインした状態で実行します。

```bash
npx wrangler login
npm run deploy
```

本番のAIキーが必要になったら `npx wrangler secret put ANTHROPIC_API_KEY` で設定します。キーをGitHubに貼り付けないでください。現在のWorkerは `AI_MODE=mock` です。Cloudflareの動作設定は `wrangler.jsonc`、OpenNext設定は `open-next.config.ts` です。

共通の型・保存API・AI応答形式は **[共通データ契約](docs/specs/shared-contract.md)** を参照してください。`shared/types`・`shared/storage`・`config/features.ts`・レイアウトは凍結対象です。

Next.js公式雛形にOpenNextを設定しています。C3は生成時にnpmエラーが発生したため、[OpenNext公式の既存アプリ設定手順](https://opennext.js.org/cloudflare/get-started)を適用しました。

## リザーブマシンの仕様検討

- **[正式仕様・全機能実装計画](docs/specs/mvp-spec.md)**：proposal2を正式採用。開発はこの仕様を基準にします。
- [採用元のproposal2](docs/specs/mvp-proposal2.md)：原案として保存。
- [メンバーAのMVP仕様書](docs/specs/member-a.md)：個人案。チームの正式仕様ではありません。
- [3人の仕様書の統合手順](docs/specs/INTEGRATION.md)：比較表・判断基準・統合用の指示文。

3案を確認し、proposal2を正式採用しました。技術・担当などの未決事項は正式仕様の第17・18章に記載しています。

## 最初に決めること

- 誰のどんな困りごとを解決するか
- 今日中に動かす最小限の機能
- 使用技術と起動方法
- メンバーごとの担当

## 参加する

招待を承認した後、ターミナルで実行します。

```bash
git clone https://github.com/ackkle/ai-hackathon-20260913.git
cd ai-hackathon-20260913
```

起動方法は上の「アプリの土台（W0）」を参照してください。

## 共同作業の流れ

1. GitHubのIssuesに作業を登録し、担当者を決める。
2. 最新のmainから自分の作業用ブランチを作る。
3. 変更をコミットしてpushし、Pull Requestを作る。
4. 別のメンバーが確認してmainにマージする。

作業開始時の例（`feature/login` は担当する機能名に置き換えます）：

```bash
git switch main
git pull --ff-only
git switch -c feature/login
```

変更を共有する例（`path/to/file` は変更したファイルに置き換えます）：

```bash
git add path/to/file
git commit -m "ログイン画面を追加"
git push -u origin feature/login
```

push後、GitHubでPull Requestを作成します。複数人が同じファイルを変更する場合は、先に担当範囲を相談してください。

## AIを使って開発するとき

- AIにも担当する機能・ファイル・ブランチを伝える。
- APIキーやパスワードはコミットせず、ローカルの `.env` に保存する。
- 必要な環境変数の名前だけを `.env.example` に書いて共有する。
- Pull Requestに変更内容と動作確認の結果を書く。
