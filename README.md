# eve-trip-planner

[Vercel Eve](https://vercel.com/docs/eve)（filesystem-first なエージェントフレームワーク, beta）を試すための**デモ用の旅行プランナーエージェント**。天気・宿・予約はすべてモックデータで、外部 API や秘密情報は使いません。

「天気を見て → 宿を探して → 旅程を組んで → 予約は人間が承認」という流れで、Eve のコア機能（tool / skill / human-in-the-loop / durable session）を最小構成で体験できます。

## 構成

```
agent/
├── agent.ts                  # model: OpenAI 直叩き（@ai-sdk/openai, OPENAI_API_KEY）
├── instructions.md           # 旅行プランナーの役割・方針（常時適用の system prompt）
├── channels/eve.ts           # scaffold 生成のチャネル設定
├── tools/
│   ├── get_weather.ts         # 都市 → モック天気
│   ├── search_hotels.ts       # 行き先・泊数・予算 → モック宿リスト
│   └── book_hotel.ts          # 宿予約。needsApproval: always() で承認ゲート付き
└── skills/
    └── plan_a_trip.md         # 旅程計画の手順（load_skill でオンデマンド読込）
```

設計と実装計画は `docs/superpowers/` を参照。

## セットアップ

依存はスキャフォールド時にインストール済み。クローンし直した場合は:

```bash
pnpm install
```

### モデル認証（ローカル実行に必須）

このエージェントは Vercel AI Gateway を経由せず、`@ai-sdk/openai` で **OpenAI を直接呼びます**（`agent/agent.ts` 参照）。`OPENAI_API_KEY` を `.env.local` に設定してください:

```
OPENAI_API_KEY=sk-...
```

> 秘密情報は `.gitignore` 済みの `.env*` にのみ置き、コミットしないこと。

別のプロバイダや Vercel AI Gateway を使いたい場合は `agent/agent.ts` の `model` を差し替える（Gateway 経由は `model: "openai/gpt-5.4-mini"` のような文字列指定。ただし Gateway はカード登録が必要）。

## 起動

`eve dev` は対話 TUI です。ターミナルで直接起動してください:

```bash
npm run dev
# = eve dev
```

HTTP セッションで会話する例:

```bash
curl -X POST http://127.0.0.1:3000/eve/v1/session \
  -H 'content-type: application/json' \
  -d '{"message":"軽井沢に2泊で旅行したい。予算は1泊2万円まで"}'
```

レスポンスの `x-eve-session-id` ヘッダを使ってストリームに再接続できます:

```bash
curl http://127.0.0.1:3000/eve/v1/session/<sessionId>/stream
```

## 会話例

1. 「軽井沢に2泊で旅行したい。予算は1泊2万円まで」
   → `get_weather` と `search_hotels`（予算フィルタ）が走り、旅程を提案
2. 「2番目の宿で予約して」
   → `book_hotel` の**承認ゲート**が発火。承認すると確認番号、拒否すると予約されない

## 開発コマンド

```bash
npm run typecheck   # tsc 型チェック
npm test            # vitest（tools のユニットテスト）
npm run build       # eve build
```

すべてデモ・モックデータです。実際の予約や決済は行いません。
