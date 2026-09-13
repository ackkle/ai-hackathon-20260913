# W0 共通データ契約（Issue #2）

実装は `src/shared/types/index.ts`。正式仕様のschemaVersion 2を使用する。

## 画面側

```ts
import { load, save, clear } from '@/shared/storage';
import { createEmptyState, type ReserveState } from '@/shared/types';

const { data, error } = load(); // ブラウザのイベント、またはuseEffect内
// errorがあれば画面に表示。破損した元データは自動削除しない。
const result = save(data); // { ok, error }。失敗なら画面に表示する。
```

- 空状態：`wish`、`blank`、`futureLife`、`tree`、`survey`はnull。各配列は空。
- `save` は全状態を保存する。直前に `load()` して変更を加え、他画面の更新を古い状態で上書きしない。
- 次の予約や振り返りは安定したIDで参照する。日付はオフセット付きISO文字列、未設定ならnull。
- 正式な状態名は `unscheduled / scheduled / registered / done / partial / not_done / skipped`。
- Issueの `proposed / reserved` は読み書き時に `unscheduled / scheduled` に正規化する。新規画面は正式な状態名を使う。
- `calendar` 初期値：`{ method: null, eventId: null, confirmedAt: null }`。
- `isDemo: true` のデータは「デモ用」と表示する。

## AI担当側（#3）

Zodスキーマを共有する。モックJSONも同じスキーマで検証する。

| task | export | 形 |
| --- | --- | --- |
| questions | QuestionsResponseSchema | category, wishSummary, questions（1〜5件） |
| candidates | CandidatesResponseSchema | candidates（3件） |
| tree | TreeResponseSchema | futureLife, tree（goals/metrics/monthly）, weekly（1〜3件） |
| next-step | NextStepResponseSchema | type, title, durationMin, prep, fallback, reason, message |
| next-week | NextWeekResponseSchema | weekly（1〜3件） |

各応答は任意の `distress: boolean` を受け付ける。treeはv1の `goal` 単独ではなく、v2の `tree.goals` を使う。weeklyの項目は `WeeklyActionSchema` を参照。予約ID・planId・カレンダー状態はAIではなくアプリ側で付ける。

## デモ担当側（#4）

`ReserveStateSchema.safeParse(json)` で全状態を検証。デモ名は `demoPersona: 'kenta'`。振り返りには `again` を指定し、未回答なら `no_answer`。空配列も含め、`createEmptyState()` の全ルート項目を持たせる。

## 機能モード

`featureModes` / `features`、`getFeatureMode(id)` をexport。未完成はmock、F-18/F-31/F-11はoff、F-37〜39はconcept。モードと画面表示を合わせる。モックAIから本物への暗黙切り替えは行わない。

変更は凍結対象のため、小さなPRで合意してから適用する。
