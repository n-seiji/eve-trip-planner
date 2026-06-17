# Eve 旅行プランナーエージェント Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **実装担当は Codex**（`codex:rescue` サブエージェント）。Claude は各タスクを Codex に投げ、出力をレビューして取りまとめる。

**Goal:** Vercel Eve でデモ用「旅行プランナー」エージェントを作り、ローカルで tool / skill / human-in-the-loop / durable session を実際に動かす。

**Architecture:** `npx eve@latest init .` で動く土台を生成し、それを旅行プランナーに作り替える。天気・宿・予約は全てモック。予約だけ human-in-the-loop 承認ゲートを噛ませる。

**Tech Stack:** Vercel Eve (beta), TypeScript, zod, AI Gateway (`anthropic/claude-sonnet-4.6`)。

**重要な前提:**
- 既に `~/ghq/github.com/n-seiji/eve-trip-planner` に git・spec・リモート(origin)が存在する。スキャフォールドは**既存ディレクトリ向けの `npx eve@latest init .`** を使う。
- ローカル起動には AI Gateway 認証が必要。Task 1 で疎通を確認し、ここで詰まったら認証手段（Vercel ログイン or `AI_GATEWAY_API_KEY`）を見直す。
- human-in-the-loop の正確な API は公開 docs に未掲載。**Task 4 で、生成済みコードと first-agent チュートリアル（https://beta.eve.dev/docs/tutorial/first-agent）から実 API を確定してから実装する**。憶測でコードを書かない。

---

### Task 1: スキャフォールドと疎通確認

**Files:**
- 生成: `agent/`（雛形一式）, `package.json`, その他 scaffold 生成物

- [ ] **Step 1: 既存ディレクトリにスキャフォールド**

作業ディレクトリ: `~/ghq/github.com/n-seiji/eve-trip-planner`

Run: `npx eve@latest init .`

対話 TUI が起動したら一旦終了してよい。`agent/` 配下に雛形（weather サンプル等）が生成され、`package.json` に dev スクリプトが入ることを確認する。

- [ ] **Step 2: 生成物を確認しコミット**

Run: `git status` で生成ファイルを確認。`.gitignore` に `node_modules` 等が入っているか確認（無ければ既存の `.gitignore` を活かす）。

```bash
git add -A
git commit -m "chore: eve init で雛形をスキャフォールド"
```

- [ ] **Step 3: AI Gateway 認証を通す**

ローカルで model 呼び出しを通すための認証を設定する。優先順:
1. `npx vercel login` で Vercel にログイン（OIDC 経由で AI Gateway が使える場合）
2. 通らなければ AI Gateway の API キーを発行し、`.env.local`（または scaffold が示す env ファイル）に `AI_GATEWAY_API_KEY=...` を設定

注意: 秘密情報は **`.gitignore` 済みの env ファイル**にのみ書く。リポジトリにコミットしない。

- [ ] **Step 4: dev サーバ起動と疎通**

Run: `pnpm dev`（scaffold の README が示す dev コマンド。`npm run dev` の場合あり）

別シェルで:
```bash
curl -X POST http://127.0.0.1:3000/eve/v1/session \
  -H 'content-type: application/json' \
  -d '{"message":"こんにちは"}'
```
Expected: `x-eve-session-id` ヘッダと `continuationToken` を含む応答が返り、ストリームに応答テキストが出る。

詰まったら: 認証エラーなら Step 3 をやり直す。port 違いなら scaffold の出力を確認する。

- [ ] **Step 5: モデルを変更**

`agent/agent.ts` の `model` を `anthropic/claude-sonnet-4.6` に変更し、再度 Step 4 の疎通を確認。

```ts
import { defineAgent } from 'eve';

export default defineAgent({
  model: 'anthropic/claude-sonnet-4.6',
});
```

```bash
git add agent/agent.ts
git commit -m "chore: モデルを claude-sonnet-4.6 に設定"
```

---

### Task 2: instructions.md を旅行プランナーに書き換え

**Files:**
- Modify: `agent/instructions.md`

- [ ] **Step 1: instructions を書く**

`agent/instructions.md` の中身を以下に置き換える:

```md
あなたは親切な日本語の旅行プランナーです。ユーザーの行き先・日程・予算をもとに、
天気を確認し、宿を探し、旅程を提案します。

方針:
- 天気は get_weather、宿の検索は search_hotels ツールを使う。
- すべてのデータはデモ用のモックである旨を、最初の提案時に一度だけ添える。
- 宿の予約（book_hotel）は必ずユーザーの明示的な承認を得てから実行する。
  勝手に予約を確定してはいけない。
- 金額は日本円・整数で扱う。
- 旅行の計画を頼まれたら、plan_a_trip スキルの手順に従う。
```

- [ ] **Step 2: 疎通確認**

`pnpm dev` 起動中に「軽井沢に旅行したい」と送り、口調・方針が反映されることを確認（この時点では tool 未実装なので一般的な応答でよい）。

- [ ] **Step 3: コミット**

```bash
git add agent/instructions.md
git commit -m "feat: instructions を旅行プランナーに設定"
```

---

### Task 3: get_weather / search_hotels ツール（モック）

**Files:**
- Create/Modify: `agent/tools/get_weather.ts`
- Create: `agent/tools/search_hotels.ts`
- 不要なら削除: scaffold が生成した sample tool（weather サンプルがあれば get_weather に転用）

> tool は `defineTool` + zod で定義し、ファイル名がツール名になる（docs 確認済み）。`execute` は純粋関数なので入出力が安定する。

- [ ] **Step 1: get_weather を書く**

`agent/tools/get_weather.ts`:

```ts
import { defineTool } from 'eve/tools';
import { z } from 'zod';

const WEATHER: Record<string, { condition: string; tempC: number }> = {
  軽井沢: { condition: '晴れ', tempC: 18 },
  東京: { condition: '曇り', tempC: 24 },
  札幌: { condition: '雨', tempC: 12 },
};

export default defineTool({
  description: '指定した都市のデモ用天気を返す（モックデータ）。',
  inputSchema: z.object({ city: z.string().min(1) }),
  async execute({ city }) {
    const w = WEATHER[city] ?? { condition: '晴れ', tempC: 20 };
    return { city, ...w, mock: true };
  },
});
```

- [ ] **Step 2: search_hotels を書く**

`agent/tools/search_hotels.ts`:

```ts
import { defineTool } from 'eve/tools';
import { z } from 'zod';

type Hotel = { id: string; name: string; pricePerNight: number };

const HOTELS: Record<string, readonly Hotel[]> = {
  軽井沢: [
    { id: 'kru-1', name: '森のオーベルジュ', pricePerNight: 18000 },
    { id: 'kru-2', name: '高原ロッジ', pricePerNight: 12000 },
    { id: 'kru-3', name: 'ラグジュアリーヴィラ', pricePerNight: 45000 },
  ],
  東京: [
    { id: 'tyo-1', name: 'シティホテル丸の内', pricePerNight: 22000 },
    { id: 'tyo-2', name: '下町ゲストハウス', pricePerNight: 8000 },
  ],
};

export default defineTool({
  description: '行き先・泊数・予算からデモ用の宿候補を返す（モックデータ）。',
  inputSchema: z.object({
    city: z.string().min(1),
    nights: z.number().int().positive(),
    maxPricePerNight: z.number().int().positive().optional(),
  }),
  async execute({ city, nights, maxPricePerNight }) {
    const all = HOTELS[city] ?? [];
    const filtered = maxPricePerNight
      ? all.filter((h) => h.pricePerNight <= maxPricePerNight)
      : all;
    return {
      city,
      nights,
      hotels: filtered.map((h) => ({ ...h, totalPrice: h.pricePerNight * nights })),
      mock: true,
    };
  },
});
```

- [ ] **Step 3: 疎通確認**

`pnpm dev` 中に「軽井沢に2泊、1泊2万円までで旅行したい」と送り、`get_weather` と `search_hotels` が呼ばれ、予算でフィルタされた宿が提案されることを確認（observability or stream で tool 呼び出しを確認）。

- [ ] **Step 4: コミット**

```bash
git add agent/tools/get_weather.ts agent/tools/search_hotels.ts
git commit -m "feat: get_weather と search_hotels モックツールを追加"
```

---

### Task 4: book_hotel ツール（human-in-the-loop 承認ゲート）

**Files:**
- Create: `agent/tools/book_hotel.ts`

> **API 確定が先。** 公開 docs に承認ゲートの具体 API が無いため、まず実 API を特定する。

- [ ] **Step 1: 承認 API を特定する**

以下を調べ、Eve の human-in-the-loop の正しい書き方を確定する:
1. first-agent チュートリアル: https://beta.eve.dev/docs/tutorial/first-agent
2. `node_modules/eve` の型定義（`eve/tools` の `defineTool` が承認/確認をどう表現するか。例: `execute` 内から承認を要求するヘルパ、または tool 定義のオプション）
3. scaffold 生成物に承認の例が含まれていないか

確定した API の要点をこのタスクにメモしてから Step 2 に進む。

- [ ] **Step 2: book_hotel を実装**

確定した承認 API を使い、`agent/tools/book_hotel.ts` を実装する。要件:
- 入力: `{ hotelId: string, hotelName: string, nights: number, totalPrice: number }`（zod）
- 実行前に「`{hotelName}` を `{nights}` 泊・¥`{totalPrice}` で仮予約します。よろしいですか？」という承認を人間に求める
- 承認 → モック確認番号 `BK-` + 短いランダム文字列を返す（`{ confirmationId, status: 'confirmed', mock: true }`）
- 拒否 → 予約せず `{ status: 'cancelled' }` を返す

実装の骨子（承認部分は Step 1 で確定した実 API に置き換える）:

```ts
import { defineTool } from 'eve/tools';
import { z } from 'zod';

export default defineTool({
  description: '宿を仮予約する。実行前に必ず人間の承認を得る（モック予約）。',
  inputSchema: z.object({
    hotelId: z.string().min(1),
    hotelName: z.string().min(1),
    nights: z.number().int().positive(),
    totalPrice: z.number().int().positive(),
  }),
  async execute(input /*, ctx: 承認 API は Step 1 で確定 */) {
    // 1) 承認を要求（確定した API に置換）
    // 2) 承認なら確認番号を発行、拒否なら cancelled を返す
  },
});
```

- [ ] **Step 3: 承認フローの動作確認**

`pnpm dev` 中に旅程提案まで進めた後「2番目の宿で予約して」と送る。
- 承認ゲートが発火すること
- 承認すると確認番号が返ること
- 拒否すると予約されないこと
をそれぞれ確認する。

- [ ] **Step 4: コミット**

```bash
git add agent/tools/book_hotel.ts
git commit -m "feat: book_hotel に human-in-the-loop 承認ゲートを実装"
```

---

### Task 5: plan_a_trip スキル

**Files:**
- Create: `agent/skills/plan_a_trip.md`

- [ ] **Step 1: スキルを書く**

`agent/skills/plan_a_trip.md`:

```md
---
name: plan_a_trip
description: 行き先・日程・予算から旅程を計画するときに使う手順。
---

# 旅行の計画手順

1. ユーザーから行き先・泊数・1泊あたり予算を確認する。不足していれば質問する。
2. get_weather で行き先の天気を確認する。
3. search_hotels で予算内の宿を取得する。候補が無ければ予算緩和を提案する。
4. 天気と宿を踏まえ、日ごとの簡単な旅程（午前/午後/宿）を提案する。
5. ユーザーが宿を選んだら book_hotel で予約する。**必ず承認を得てから確定する。**
6. 予約確定後、確認番号と旅程サマリを伝える。
```

- [ ] **Step 2: スキル読込の確認**

`pnpm dev` 中に「旅行を計画して」と送り、skill が読み込まれ手順通り（行き先確認 → 天気 → 宿 → 旅程 → 予約承認）に進むことを確認する。

- [ ] **Step 3: コミット**

```bash
git add agent/skills/plan_a_trip.md
git commit -m "feat: plan_a_trip スキルを追加"
```

---

### Task 6: ツールのユニットテスト

**Files:**
- Test: `agent/tools/get_weather.test.ts`, `agent/tools/search_hotels.test.ts`
- Modify: `package.json`（test スクリプト、scaffold に無ければ vitest を追加）

> `execute` は純粋関数なので、入出力を検証する軽量テストに絞る（デモなので過剰なテストは作らない）。承認を伴う book_hotel は手動確認（Task 4 Step 3）で代替する。

- [ ] **Step 1: テストランナーを用意**

scaffold に test スクリプトが無ければ vitest を追加する:
```bash
pnpm add -D vitest
```
`package.json` の scripts に `"test": "vitest run"` を追加。

- [ ] **Step 2: get_weather のテストを書く（失敗確認）**

`agent/tools/get_weather.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import tool from './get_weather';

describe('get_weather', () => {
  it('既知の都市は固定の天気を返す', async () => {
    const r = await tool.execute({ city: '軽井沢' });
    expect(r).toMatchObject({ city: '軽井沢', condition: '晴れ', tempC: 18, mock: true });
  });

  it('未知の都市はデフォルト値を返す', async () => {
    const r = await tool.execute({ city: '未知都市' });
    expect(r).toMatchObject({ city: '未知都市', mock: true });
  });
});
```

Run: `pnpm test`
Expected: tool の export 形が違えば FAIL。`tool.execute` の呼び出し方が実 API と異なる場合は、Task 1 で確認した `defineTool` の戻り値の形に合わせて修正する。

- [ ] **Step 3: search_hotels のテストを書く**

`agent/tools/search_hotels.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import tool from './search_hotels';

describe('search_hotels', () => {
  it('予算でフィルタし、泊数で合計金額を計算する', async () => {
    const r = await tool.execute({ city: '軽井沢', nights: 2, maxPricePerNight: 20000 });
    expect(r.hotels.every((h) => h.pricePerNight <= 20000)).toBe(true);
    expect(r.hotels.find((h) => h.id === 'kru-1')?.totalPrice).toBe(36000);
  });

  it('該当都市が無ければ空配列を返す', async () => {
    const r = await tool.execute({ city: '海外', nights: 1 });
    expect(r.hotels).toEqual([]);
  });
});
```

- [ ] **Step 4: テストを通す**

Run: `pnpm test`
Expected: PASS。FAIL する場合は実装側ではなく `tool.execute` の呼び出し方（実 API）を確認して合わせる。

- [ ] **Step 5: コミット**

```bash
git add agent/tools/*.test.ts package.json pnpm-lock.yaml
git commit -m "test: get_weather と search_hotels のユニットテストを追加"
```

---

### Task 7: README と最終確認

**Files:**
- Create/Modify: `README.md`

- [ ] **Step 1: README を書く**

`README.md` に以下を記載: 概要（Eve デモ・旅行プランナー）、セットアップ（`npx eve@latest init` 済み前提、AI Gateway 認証手順、`pnpm dev`）、会話例（軽井沢2泊 → 予約承認）、これがデモ・全データモックである旨。

- [ ] **Step 2: 受け入れ基準を通しで確認**

`pnpm dev` 起動中に、spec のテスト戦略 4 項目を順に確認:
1. 疎通（単純応答が返る）
2. tool 呼び出し（天気）
3. skill + 複合フロー（旅行計画）
4. human-in-the-loop（予約の承認/拒否分岐）

- [ ] **Step 3: コミットして push**

```bash
git add README.md
git commit -m "docs: README を追加"
git push
```
