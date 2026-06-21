import type { ToolContext } from "eve/tools";

// テスト用のスタブ context。これらのツールは ctx を参照しないため空で良い。
// execute の第2引数は型上必須なので、型の隙間をこのヘルパー1か所に集約する。
export const stubToolContext = (): ToolContext => ({}) as unknown as ToolContext;
