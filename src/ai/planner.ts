import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts";
import { logger } from "../utils/logger";

export interface Plan {
  thought: string;
  action: string;
  params: Record<string, unknown>;
}

export class Planner {
  private client: Anthropic;
  private conversationHistory: { role: "user" | "assistant"; content: string }[] = [];
  private maxHistory = 10;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async decide(stateString: string, lastResult: string | null): Promise<Plan> {
    const userPrompt = buildUserPrompt(stateString, lastResult);

    this.conversationHistory.push({ role: "user", content: userPrompt });

    // Keep history bounded
    if (this.conversationHistory.length > this.maxHistory * 2) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistory * 2);
    }

    try {
      const response = await this.client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        system: SYSTEM_PROMPT,
        messages: this.conversationHistory,
      });

      const text = response.content[0];
      if (text.type !== "text") {
        throw new Error("Unexpected response type");
      }

      const raw = text.text.trim();
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
