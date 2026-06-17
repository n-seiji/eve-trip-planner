# Eve 旅行プランナーエージェント 設計

- 日付: 2026-06-17
- ステータス: 設計承認済み（実装は Codex に委譲）

## 目的

Vercel Eve（オープンソースのエージェントフレームワーク, 2026/6/17 発表, beta）を実際に触り、
**コア機能（tool / skill / human-in-the-loop / durable session）を最小構成で一通り体験する**こと。
題材は理解しやすいデモとして「旅行プランナー」を採用する。外部 API は使わず全てモックで完結させ、
秘密情報・認証の心配をなくす。

ゴールは **ローカルで実際に動かす（goal 2）**こと。スキャフォールドして定義を書くだけでなく、
`pnpm dev` で起動し `POST /eve/v1/session` で会話・tool 呼び出し・承認ゲートまで通す。

## 全体像

- リポジトリ: `~/ghq/github.com/n-seiji/eve-trip-planner`（新規）
- エージェント: 旅行プランナー。「天気を見て → 宿を探して → 旅程を組んで → 予約は人間が承認」
- スキャフォールド: `npx eve@latest init eve-trip-planner`（または既存ディレクトリへ `init .`）で雛形生成 → 作り込む
- モデル: `anthropic/claude-sonnet-4.6`（AI Gateway 経由）
- 実装担当: Codex（`codex:rescue` サブエージェント）。Claude が設計・計画・レビューを担当する

### ローカル起動の前提（重要なリスク/依存）

Eve はモデル呼び出しを AI Gateway 経由で行う。ローカルで実際に動かすには AI Gateway 認証が必要:
Vercel ログイン（OIDC）か、`AI_GATEWAY_API_KEY` 等の環境変数で通す。
**この認証が通らないと goal 2 に到達できない**ため、実装の最初に「最小エージェントでの疎通確認」を行い、
ここで詰まったら認証手段を見直す。

## ファイル構成

```
eve-trip-planner/
└── agent/
    ├── agent.ts                 # model: anthropic/claude-sonnet-4.6
    ├── instructions.md          # 役割・口調・「予約は必ず承認を取る」方針
    ├── tools/
    │   ├── get_weather.ts        # 都市名 → モック天気
    │   ├── search_hotels.ts      # 行き先・日程・予算 → モック宿リスト
    │   └── book_hotel.ts         # 宿ID → 仮予約。human-in-the-loop 承認ゲート付き
    └── skills/
        └── plan_a_trip.md        # 「天気確認 → 宿検索 → 旅程提案 → 予約承認」の手順書
```

- tool は 1 ファイル 1 ツール。`defineTool` + zod スキーマ。データは全てモック（外部 API なし）
- skill はオンデマンド読込。「旅行を計画して」と言われた時に `plan_a_trip` が手順を与える
- human-in-the-loop は `book_hotel` に適用。Eve の承認ゲート API（実装前に docs/concepts で正確な
  API を確認する）を使い、「予約していいですか？」で人間の承認待ちにする

## データフロー（会話例）

```
ユーザー: 「軽井沢に2泊で旅行したい。予算は1泊2万円まで」
  ├─ skill: plan_a_trip を読込（手順を取得）
  ├─ tool: get_weather("軽井沢") → { condition: "晴れ", tempC: 18 }
  ├─ tool: search_hotels({ city:"軽井沢", nights:2, maxPrice:20000 })
  │         → [ {id, name, pricePerNight}, ... ]（モック3件）
  └─ エージェント: 天気＋宿を踏まえた旅程を提案

ユーザー: 「2番目の宿で予約して」
  └─ tool: book_hotel({ hotelId })
        └─ 承認ゲート: 「○○を2泊¥38,000で仮予約します。よろしいですか？」
             ├─ 承認 → 予約確定（モック確認番号を返す）
             └─ 拒否 → 予約せず中断
```

- 全ステップが durable session で checkpoint される（途中で止めても再開可能 ＝ Eve の目玉を体感）
- モックデータは tool 内にハードコード（都市ごとに数件の宿、天気は固定 or 擬似ランダム）

## モックデータ方針

- `get_weather`: 既知の都市（軽井沢, 東京, 札幌 等）は固定値、未知の都市はデフォルト値を返す
- `search_hotels`: 都市ごとに 2〜3 件の宿を持ち、`maxPrice` でフィルタして返す
- `book_hotel`: 受け取った `hotelId` に対しモックの確認番号（例: `BK-XXXX`）を返す。承認されなければ予約しない

## テスト戦略 / 動作確認

ローカルで goal 2 を達成できたと言える基準:

1. 疎通: `pnpm dev` 起動 → AI Gateway 認証が通り、`POST /eve/v1/session` で単純な応答が返る
2. tool 呼び出し: 「軽井沢の天気は？」で `get_weather` が呼ばれた跡が stream/observability に出る
3. skill + 複合フロー: 「旅行を計画して」で skill が読まれ、weather → hotels → 旅程提案まで通る
4. human-in-the-loop: 「予約して」で承認ゲートが発火し、承認/拒否で挙動が分岐する

ユニットテストは tool の `execute`（純粋関数なのでモック入出力を検証）に絞る。
会話フローは手動の curl / observability 確認とする（お試しデモなので過剰なテストは作らない）。

## YAGNI / スコープ外

- 本物の天気/宿 API 連携 — しない（全てモック）
- channels（Slack/Discord）/ schedules（cron）— 今回は載せない（必要になれば後追い）
- 永続 DB — Eve の durable session に任せ、独自 DB は持たない
