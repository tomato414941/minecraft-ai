import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts";
import { logger } from "../utils/logger";

export interface Plan {
  thought: string;
  action: string;
  params: Record<string, unknown>;
}

const LLM_BASE_URL = process.env.LLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4";
const LLM_MODEL = process.env.LLM_MODEL ?? "glm-4-flash";

export class Planner {
  private apiKey: string;
  private conversationHistory: { role: "user" | "assistant"; content: string }[] = [];
  private maxHistory = 10;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async decide(stateString: string, lastResult: string | null): Promise<Plan> {
    const userPrompt = buildUserPrompt(stateString, lastResult);

    this.conversationHistory.push({ role: "user", content: userPrompt });

    // Keep history bounded
    if (this.conversationHistory.length > this.maxHistory * 2) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistory * 2);
    }

    try {
      const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: LLM_MODEL,
          max_tokens: 256,
          enable_thinking: false,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...this.conversationHistory,
          ],
        }),
      });

      if (!res.ok) {
        throw new Error(`${res.status} ${await res.text()}`);
      }

      const data = await res.json();
      const msg = data.choices[0].message;
      const raw: string = (msg.content || msg.reasoning_content || "").trim();
      logger.ai(`Response: ${raw}`);

      this.conversationHistory.push({ role: "assistant", content: raw });

      const plan = parseResponse(raw);
      logger.ai(`Plan: ${plan.thought}`);
      return plan;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Planner error: ${msg}`);

      // Fallback: explore randomly
      return {
        thought: "API error, exploring randomly",
        action: "explore",
        params: { direction: "random", count: 20 },
      };
    }
  }
}

function parseResponse(raw: string): Plan {
  // Strip markdown code fences if present
  let cleaned = raw;
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned);
    return {
      thought: parsed.thought ?? "no reasoning",
      action: parsed.action ?? "explore",
      params: parsed.params ?? {},
    };
  } catch {
    logger.warn(`Failed to parse AI response, falling back to explore`);
    return {
      thought: "Parse error, exploring randomly",
      action: "explore",
      params: { direction: "random", count: 20 },
    };
  }
}
