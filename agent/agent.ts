import { openai } from "@ai-sdk/openai";
import { defineAgent } from "eve";

// Vercel AI Gateway を経由せず OpenAI を直接呼ぶ。OPENAI_API_KEY が必要。
export default defineAgent({
  model: openai("gpt-5.4-mini"),
});
