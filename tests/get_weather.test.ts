import { describe, it, expect } from "vitest";
import tool from "../agent/tools/get_weather.js";
import { stubToolContext } from "./_test-context.js";

describe("get_weather", () => {
  it("既知の都市は固定の天気を返す", async () => {
    const r = await tool.execute({ city: "軽井沢" }, stubToolContext());
    expect(r).toMatchObject({ city: "軽井沢", condition: "晴れ", tempC: 18, mock: true });
  });

  it("未知の都市はデフォルト値を返す", async () => {
    const r = await tool.execute({ city: "未知都市" }, stubToolContext());
    expect(r).toMatchObject({ city: "未知都市", mock: true });
  });
});
