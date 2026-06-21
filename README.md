# eve-trip-planner

[Vercel Eve](https://vercel.com/docs/eve)（filesystem-first なエージェントフレームワーク, beta）を試すための**デモ用の旅行プランナーエージェント**。天気・宿・予約はすべてモックデータで、外部 API や秘密情報は使いません。

「天気を見て → 宿を探して → 旅程を組んで → 予約は人間が承認」という流れで、Eve のコア機能（tool / skill / human-in-the-loop / durable session）を最小構成で体験できます。

## 構成

```
agent/
├── agent.ts                  # model: anthropic/claude-sonnet-4.6（AI Gateway 経由）
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
npm install
```

### AI Gateway 認証（ローカル実行に必須）

Eve はモデル呼び出しを [AI Gateway](https://vercel.com/docs/ai-gateway) 経由で行います。ローカルで動かすには認証が必要です。いずれかを用意してください:

- Vercel にログイン（OIDC）: `npx vercel login`
- もしくは AI Gateway の API キーを発行し、`.env.local` に設定:
  ```
  AI_GATEWAY_API_KEY=...
  ```

> 秘密情報は `.gitignore` 済みの `.env*` にのみ置き、コミットしないこと。

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
