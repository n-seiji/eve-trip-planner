import { defineTool } from "eve/tools";
import { z } from "zod";

type Hotel = { id: string; name: string; pricePerNight: number };

const HOTELS: Record<string, readonly Hotel[]> = {
  軽井沢: [
    { id: "kru-1", name: "森のオーベルジュ", pricePerNight: 18000 },
    { id: "kru-2", name: "高原ロッジ", pricePerNight: 12000 },
    { id: "kru-3", name: "ラグジュアリーヴィラ", pricePerNight: 45000 },
  ],
  東京: [
    { id: "tyo-1", name: "シティホテル丸の内", pricePerNight: 22000 },
    { id: "tyo-2", name: "下町ゲストハウス", pricePerNight: 8000 },
  ],
};

export default defineTool({
  description: "行き先・泊数・予算からデモ用の宿候補を返す（モックデータ）。",
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
