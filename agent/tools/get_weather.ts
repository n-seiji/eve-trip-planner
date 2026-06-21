import { defineTool } from "eve/tools";
import { z } from "zod";

const WEATHER: Record<string, { condition: string; tempC: number }> = {
  軽井沢: { condition: "晴れ", tempC: 18 },
  東京: { condition: "曇り", tempC: 24 },
  札幌: { condition: "雨", tempC: 12 },
};

export default defineTool({
  description: "指定した都市のデモ用天気を返す（モックデータ）。",
  inputSchema: z.object({ city: z.string().min(1) }),
  async execute({ city }) {
    const w = WEATHER[city] ?? { condition: "晴れ", tempC: 20 };
    return { city, ...w, mock: true };
  },
});
