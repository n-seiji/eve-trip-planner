import { describe, it, expect } from "vitest";
import tool from "../agent/tools/search_hotels.js";
import { stubToolContext } from "./_test-context.js";

describe("search_hotels", () => {
  it("予算でフィルタし、泊数で合計金額を計算する", async () => {
    const r = await tool.execute(
      { city: "軽井沢", nights: 2, maxPricePerNight: 20000 },
      stubToolContext(),
    );
    expect(r.hotels.every((h) => h.pricePerNight <= 20000)).toBe(true);
    expect(r.hotels.find((h) => h.id === "kru-1")?.totalPrice).toBe(36000);
  });

  it("該当都市が無ければ空配列を返す", async () => {
    const r = await tool.execute({ city: "海外", nights: 1 }, stubToolContext());
    expect(r.hotels).toEqual([]);
  });
});
