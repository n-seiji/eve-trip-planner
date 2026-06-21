import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

// 仮予約のモック確認番号を生成する。デモ用なので暗号強度は不要。
const confirmationId = (): string => {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BK-${suffix}`;
};

export default defineTool({
  description: "宿を仮予約する。実行前に必ず人間の承認を得る（モック予約）。",
  inputSchema: z.object({
    hotelId: z.string().min(1),
    hotelName: z.string().min(1),
    nights: z.number().int().positive(),
    totalPrice: z.number().int().positive(),
  }),
  // 承認ゲート: 呼び出すたびに人間の承認を必須にする。
  // 拒否された場合 execute は実行されないため、ここでは確定処理のみを書く。
  needsApproval: always(),
  async execute({ hotelId, hotelName, nights, totalPrice }) {
    return {
      status: "confirmed" as const,
      confirmationId: confirmationId(),
      hotelId,
      hotelName,
      nights,
      totalPrice,
      mock: true,
    };
  },
});
